require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  EndBehaviorType,
} = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const { TOKEN } = process.env;

// Bot command prefix
const prefix = "don!";

let isTalking = false;
let voiceConnection = null;
let player = null;
let target = null;
let onOff = true;

// Bot commands
const Commands = {
  target: {
    help: "Set the person that Donnie will target. Usage: don!target @User",
    execute: async (message) => {
      if (message.mentions.users.size < 1) {
        message.reply("Must mention a valid user.");
      } else {
        target = message.mentions.users.first().id;
        message.reply(
          `Target set to ${message.mentions.users.first().username}`
        );
        checkForUserInVoice(message);
      }
    },
  },
  stop: {
    help: "Turn Donnie off.",
    execute: () => {
      if (voiceConnection) {
        voiceConnection.destroy();
      }
      onOff = false;
    },
  },
  start: {
    help: "Turn Donnie on.",
    execute: () => {
      onOff = true;
    },
  },
  join: {
    help: "Make the bot join the General voice channel.",
    execute: async (message) => {
      const channel = message.guild.channels.cache.find(
        (ch) => ch.name === "General" && ch.type === 2
      ); // 2 is the type for voice channels
      if (!channel) {
        message.reply("General voice channel not found!");
        return;
      }
      joinChannel(channel);
      message.reply("Joined the General voice channel!");
    },
  },
  help: {
    help: "List commands for Donnie.",
    execute: (message) => {
      const helpMessage = new EmbedBuilder().setTitle("Donnie Bot Help");

      for (const key in Commands) {
        helpMessage.addFields({
          name: `${prefix}${key}`,
          value: Commands[key].help,
        });
      }
      message.reply({ embeds: [helpMessage] });
    },
  },
};

// Client ready up handler
client.on("ready", () => {
  console.log("Sheeeshhhhhhhhhhhh");
});

// Message handler
client.on("messageCreate", (message) => {
  if (message.content.startsWith(prefix)) {
    const cmd = message.content.substr(prefix.length).split(" ")[0];
    if (Commands[cmd]) {
      Commands[cmd].execute(message);
    } else {
      message.reply('Command not found, use "don!help" to see commands.');
    }
  }
});

// When user in guild joins a voice channel, check if it is the target
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.id === target && onOff) {
    if (
      newState.channelId !== null &&
      oldState.channelId !== newState.channelId
    ) {
      const channel = await client.channels.fetch(newState.channelId);
      joinChannel(channel);
    } else if (
      oldState.channelId !== null &&
      newState.channelId === null &&
      voiceConnection != null
    ) {
      voiceConnection.destroy();
      voiceConnection = null;
    }
  }
});

// This function plays the Donnie audio
const play = () => {
  if (!voiceConnection) return;

  const resource = createAudioResource("./donnie.mp3");
  player = createAudioPlayer();

  player.play(resource);
  voiceConnection.subscribe(player);

  player.on(AudioPlayerStatus.Idle, () => {
    if (isTalking) {
      play();
    }
  });

  player.on("error", (error) => {
    console.error(`Error: ${error.message}`);
  });
};

// Check if target is in voice and join/disconnect accordingly
const checkForUserInVoice = async (message) => {
  const vcs = client.channels.cache.filter((c) => c.type === 2); // 2 is the type for voice channels

  for (const [key, value] of vcs) {
    if (value.members.has(target)) {
      joinChannel(value);
      return;
    }
  }
  if (voiceConnection) {
    voiceConnection.destroy();
  }
};

// Join a voice channel and setup speaking event listeners
const joinChannel = (channel) => {
  voiceConnection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  voiceConnection.on(VoiceConnectionStatus.Ready, () => {
    console.log("The bot has connected to the channel!");
    const receiver = voiceConnection.receiver;

    receiver.speaking.on("start", (userId) => {
      if (userId === target && onOff) {
        if (!isTalking) {
          isTalking = true;
          play();
        }
      }
    });

    receiver.speaking.on("end", (userId) => {
      if (userId === target && onOff) {
        if (isTalking) {
          isTalking = false;
          player.stop();
        }
      }
    });
  });

  voiceConnection.on("error", (error) => {
    console.error(`Connection error: ${error.message}`);
  });
};

// Handle unhandled promise rejections and other errors
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

client.on("error", (error) => {
  console.error("Client error:", error);
});

// Login using bot API token
client.login(TOKEN);
