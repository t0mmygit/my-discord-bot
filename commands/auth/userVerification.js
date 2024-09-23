const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { PREFIX, COLOR_SECONDARY, COLOR_SUCCESS, COLOR_ERROR, COLLECTOR_TIME } = require('@/constant.js');
const { wrapInBold, wrapInCodeBlock } = require('@utils');
const logError = require('@/handlers/errorHandler');
const { User } = require('@models/index');

module.exports = {
    async execute(message) {
        const embed = new EmbedBuilder()
            .setTitle('User Verification')
            .setDescription(`Hey ${message.author.username}, you're new around here! Please click on the button below to verify your account.`)
            .setColor(COLOR_SECONDARY);

        const verifiedEmbed = new EmbedBuilder()
            .setTitle('User Verification')
            .setDescription(
                'Your account has been verified!\n\n' + 
                `Type ${wrapInCodeBlock(PREFIX + ' help', 'single')} to get started with the bot.`
            )
            .setColor(COLOR_SUCCESS);
                
        const cancelEmbed = new EmbedBuilder()
            .setTitle('User Verification')
            .setDescription('Your account verification has been cancelled.')
            .setColor(COLOR_ERROR);

        const confirm = new ButtonBuilder()
            .setCustomId('verify')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Primary);

        const cancel = new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder()
            .addComponents(cancel, confirm);

        const response = await message.reply({
            embeds: [embed],
            components: [row],
        });       

        const filter = (interaction) => interaction.user.id === message.author.id;

        try {
            const verification = await response.awaitMessageComponent({ filter: filter, time: COLLECTOR_TIME });

            if (verification.customId === 'verify') {
                await User.create({ discord_id: message.author.id });

                await verification.message.edit({ 
                    embeds: [verifiedEmbed],
                    components: [],
                });
            }

            if (verification.customId === 'cancel') {
                await verification.message.edit({
                    embeds: [cancelEmbed],
                    components: [],
                });
            }
        } catch (error) { 
            if (error.message.includes('time')) {
                const timeoutEmbed = EmbedBuilder.from(response.embeds[0]).setColor(COLOR_ERROR);

                response.edit({
                    content: wrapInBold('Timed out! Please try again.'),
                    embeds: [timeoutEmbed],
                    components: [],
                });
            } else {
                logError(error, __filename);
            }
        }
    },
}