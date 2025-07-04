const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    bold,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    EmbedBuilder,
    inlineCode,
    MessageFlags,
} = require("discord.js");
const {
    COLOR_SECONDARY,
    COLOR_SUCCESS,
    COLOR_ERROR,
    COLLECTOR_TIME,
} = require("@/constant.js");
const { Channel, Guild } = require("@models");
const { handleError } = require("@handlers/errorHandler");
const channelSchema = require("@schemas/channel-settings");
const appHasPermission = require("@middlewares/appHasPermission");
const schema = require("@schemas/channel-settings");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("toggle-qualify-by-reaction")
        .setDescription(
            "Toggle to qualify message by reaction for this channel."
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    middlewares: [
        appHasPermission([
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ViewChannel,
        ]),
    ],

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await qualifyByReaction(interaction);
        } catch (error) {
            await handleError(error, __filename);
        }
    },
};

async function qualifyByReaction(interaction) {
    const [channel, channelSettings] = await getChannelSettings(interaction);
    const [embed, row] = buildConfirmationEmbed(channelSettings);

    const response = await interaction.editReply({
        embeds: [embed.setColor(COLOR_SECONDARY)],
        components: [row],
    });

    await handleResponse(response, embed, channel, channelSettings);
}

async function getChannel(interaction) {
    const { guildId, channelId } = interaction;

    let channel = await Channel.findOne({
        where: { discord_channel_Id: channelId },
    });

    if (!channel) {
        const [guild] = await Guild.findOrCreate({
            where: { server_id: guildId },
        });

        channel = await guild.createChannel({
            discord_channel_id: channelId,
        });
    }

    return channel;
}

/*
 * Retrieve then validates channel settings.
 *
 * @param {Object} interaction
 * @returns {[Object, Object]}
 */
async function getChannelSettings(interaction) {
    const channel = await getChannel(interaction);

    // 'validateAsync' argument requires JavaScript object instead of JSON format.
    console.info("Channel Settings: ", channel.settings);
    const parsedSettings = JSON.parse(channel.settings);
    const validatedSettings = await validateChannelSettings(parsedSettings);
    console.log("Validated Settings: ", validatedSettings);

    return [channel, validatedSettings];
}

async function validateChannelSettings(settings) {
    try {
        return await channelSchema.validateAsync(settings.value);
    } catch (error) {
        // Temporary solution.
        console.error(
            "[Unsolved Validation Error] Channel Settings Validation Error!"
        );
    }
}

function buildConfirmationEmbed(settings) {
    const embed = new EmbedBuilder()
        .setTitle("Channel Settings Configuration")
        .setDescription(
            `Set ${inlineCode("Qualify By Reaction")} to ${bold(!settings.allowQualifyByReaction)}?`
        );

    const confirm = new ButtonBuilder()
        .setCustomId("confirm")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success);

    const cancel = new ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    return [embed, row];
}

async function handleResponse(response, embed, channel, channelSettings) {
    const collectorFilter = (interaction) =>
        interaction.user.id === response.interaction.user.id;

    try {
        const confirmation = await response.awaitMessageComponent({
            filter: collectorFilter,
            time: COLLECTOR_TIME,
        });

        if (confirmation.customId === "confirm") {
            const updatedSettings = await updateSettings(
                channel,
                channelSettings
            );
            const parsedSettings = JSON.parse(updatedSettings).value;

            const confirmedEmbed = embed
                .setColor(COLOR_SUCCESS)
                .setDescription(
                    `${inlineCode("Qualify By Reaction")} had set to ${bold(parsedSettings.allowQualifyByReaction)}!`
                );

            await confirmation.update({
                content: bold("Confirmed!"),
                embeds: [confirmedEmbed],
                components: [],
            });
        } else if (confirmation.customId === "cancel") {
            await confirmation.update({
                content: bold("Cancelled!"),
                embeds: [embed.setColor(COLOR_ERROR)],
                components: [],
            });
        }
    } catch (error) {
        await handleError(error, __filename);
    }
}
/*
 * Inverse `allowQualifyByReaction` boolean value.
 *
 * @param {Object} channel
 * @param {Object} channelSettings
 * @returns {JSON}
 */
async function updateSettings(channel, channelSettings) {
    channelSettings.allowQualifyByReaction =
        !channelSettings.allowQualifyByReaction;

    const settings = JSON.stringify({
        value: channelSettings,
    });
    await channel.set({ settings: settings });
    await channel.save();

    return channel.settings;
}
