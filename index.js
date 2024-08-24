const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, ActivityType, Embed } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	], 
});

module.exports.client = client;

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING-INDEX] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

client.once(Events.ClientReady, client => {
	const bot = client.user; 
	const channels = client.channels;
	const channelID = '1236677665042468935';
	let currentTime = new Date();

	bot.setStatus('idle')
	bot.setActivity('discord.js', { type: ActivityType.Playing })

	channels.fetch(channelID)
		.then(channel => channel.send(`${bot.tag} is now online! Time: ${currentTime}`))
		.then(console.log(`Ready! Logged in as ${bot.tag}`))
		.catch(console.error)
})

client.on(Events.MessageCreate, async message => {
	if (!message.content.startsWith('?prxer')) return
	const command = client.commands.get('menu');
	
	try {
		await command.execute(client, message)
	} catch (error) {
		console.log('Message Error:', error)
	}
})

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	} 

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: '1. There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: '2. There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
