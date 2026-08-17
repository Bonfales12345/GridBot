const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName('roll').setDescription('Roll dice, e.g. 2d20+5')
    .addStringOption(o => o.setName('dice').setDescription('Dice notation').setRequired(true)),
  new SlashCommandBuilder().setName('trivia').setDescription('Random trivia question'),
  new SlashCommandBuilder().setName('rps').setDescription('Rock, Paper, Scissors')
    .addStringOption(o => o.setName('choice').setDescription('rock, paper, or scissors').setRequired(true)
      .addChoices({ name: 'rock', value: 'rock' }, { name: 'paper', value: 'paper' }, { name: 'scissors', value: 'scissors' })),
  new SlashCommandBuilder().setName('coinflip').setDescription('Heads or tails'),
  new SlashCommandBuilder().setName('pick').setDescription('Pick one from a comma-separated list')
    .addStringOption(o => o.setName('options').setDescription('item1, item2, item3').setRequired(true)),
  new SlashCommandBuilder().setName('poll').setDescription('Create a simple poll')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Comma-separated options').setRequired(true)),
  new SlashCommandBuilder().setName('avatar').setDescription('Get a user avatar')
    .addUserOption(o => o.setName('user').setDescription('Target user')),
  new SlashCommandBuilder().setName('userinfo').setDescription('Get user account info')
    .addUserOption(o => o.setName('user').setDescription('Target user')),
  new SlashCommandBuilder().setName('meme').setDescription('Random meme'),
  new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  new SlashCommandBuilder().setName('fact').setDescription('Random fun fact'),
  new SlashCommandBuilder().setName('dog').setDescription('Random dog image'),
  new SlashCommandBuilder().setName('cat').setDescription('Random cat image'),
  new SlashCommandBuilder().setName('color').setDescription('Preview a hex color')
    .addStringOption(o => o.setName('hex').setDescription('Hex code, e.g. #ff0000').setRequired(true)),
  new SlashCommandBuilder().setName('timestamp').setDescription('Generate a Discord relative timestamp')
    .addStringOption(o => o.setName('date').setDescription('Date, e.g. 2026-01-01 or 2026-01-01 14:00').setRequired(true)),
  new SlashCommandBuilder().setName('qr').setDescription('Generate a QR code')
    .addStringOption(o => o.setName('url').setDescription('URL or text').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
}

function rollDice(input) {
  const match = input.replace(/\s/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = Math.min(parseInt(match[1] || '1', 10), 100);
  const sides = Math.min(parseInt(match[2], 10), 1000);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { rolls, mod, total };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function decodeHTML(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&eacute;/g, 'é')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&auml;/g, 'ä')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&rsquo;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function isValidHex(hex) {
  return /^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex);
}

function normalizeHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return h.toUpperCase();
}

const EIGHTBALL_ANSWERS = [
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes, definitely.',
  'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
  'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
  'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  "Don't count on it.", 'My reply is no.', 'My sources say no.',
  'Outlook not so good.', 'Very doubtful.',
];

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  try {
    if (commandName === 'roll') {
      const dice = interaction.options.getString('dice');
      const result = rollDice(dice);
      if (!result) {
        await interaction.reply({ content: 'Invalid format. Use something like `2d20+5`.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(`🎲 Roll: ${dice}`)
        .setDescription(`Rolls: [${result.rolls.join(', ')}]${result.mod ? ` ${result.mod >= 0 ? '+' : ''}${result.mod}` : ''}\n**Total: ${result.total}**`)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'trivia') {
      await interaction.deferReply();
      const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
      const data = await res.json();
      const q = data.results[0];
      const correct = decodeHTML(q.correct_answer);
      const answers = shuffle([correct, ...q.incorrect_answers.map(decodeHTML)]);
      const letters = ['🇦', '🇧', '🇨', '🇩'];
      const embed = new EmbedBuilder()
        .setTitle('🧠 Trivia')
        .setDescription(`**${decodeHTML(q.question)}**\n\n${answers.map((a, i) => `${letters[i]} ${a}`).join('\n')}`)
        .setFooter({ text: `Category: ${decodeHTML(q.category)} | Difficulty: ${q.difficulty}` })
        .setColor(0xFEE75C);
      await interaction.editReply({ embeds: [embed] });
      setTimeout(async () => {
        try {
          await interaction.followUp({ content: `✅ Answer: **${correct}**` });
        } catch {}
      }, 15000);
    }

    else if (commandName === 'rps') {
      const choice = interaction.options.getString('choice').toLowerCase();
      const options = ['rock', 'paper', 'scissors'];
      const botChoice = options[Math.floor(Math.random() * 3)];
      let result;
      if (choice === botChoice) result = "It's a tie!";
      else if (
        (choice === 'rock' && botChoice === 'scissors') ||
        (choice === 'paper' && botChoice === 'rock') ||
        (choice === 'scissors' && botChoice === 'paper')
      ) result = 'You win! 🎉';
      else result = 'I win! 🤖';
      const embed = new EmbedBuilder()
        .setTitle('✊✋✌️ Rock Paper Scissors')
        .setDescription(`You chose **${choice}**\nI chose **${botChoice}**\n\n${result}`)
        .setColor(0x57F287);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'coinflip') {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
      const embed = new EmbedBuilder()
        .setTitle('🪙 Coin Flip')
        .setDescription(`Result: **${result}**`)
        .setColor(0xFFD700);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'pick') {
      const raw = interaction.options.getString('options');
      const items = raw.split(',').map(s => s.trim()).filter(Boolean);
      if (items.length < 2) {
        await interaction.reply({ content: 'Provide at least two comma-separated options.', ephemeral: true });
        return;
      }
      const choice = items[Math.floor(Math.random() * items.length)];
      const embed = new EmbedBuilder()
        .setTitle('🎯 Picked')
        .setDescription(`**${choice}**`)
        .setFooter({ text: `From: ${items.join(', ')}` })
        .setColor(0xEB459E);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'poll') {
      const question = interaction.options.getString('question');
      const raw = interaction.options.getString('options');
      const options = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
      const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${question}`)
        .setDescription(options.map((o, i) => `${emojis[i]} ${o}`).join('\n'))
        .setFooter({ text: `Poll by ${interaction.user.username}` })
        .setColor(0x5865F2);
      const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
      for (let i = 0; i < options.length; i++) {
        await reply.react(emojis[i]);
      }
    }

    else if (commandName === 'avatar') {
      const user = interaction.options.getUser('user') || interaction.user;
      const url = user.displayAvatarURL({ size: 1024, extension: 'png' });
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(url)
        .setColor(0x5865F2)
        .setDescription(`[Direct link](${url})`);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'userinfo') {
      const user = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
      const createdTs = Math.floor(user.createdTimestamp / 1000);
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: 'User ID', value: user.id, inline: true },
          { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          { name: 'Account Created', value: `<t:${createdTs}:D> (<t:${createdTs}:R>)`, inline: false },
        )
        .setColor(0x5865F2);
      if (member && member.joinedTimestamp) {
        const joinedTs = Math.floor(member.joinedTimestamp / 1000);
        embed.addFields({ name: 'Joined Server', value: `<t:${joinedTs}:D> (<t:${joinedTs}:R>)`, inline: false });
      }
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'meme') {
      await interaction.deferReply();
      const res = await fetch('https://meme-api.com/gimme');
      const data = await res.json();
      const embed = new EmbedBuilder()
        .setTitle(data.title || 'Random Meme')
        .setImage(data.url)
        .setFooter({ text: `👍 ${data.ups ?? 0} | r/${data.subreddit ?? 'memes'}` })
        .setColor(0xFF4500);
      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === '8ball') {
      const question = interaction.options.getString('question');
      const answer = EIGHTBALL_ANSWERS[Math.floor(Math.random() * EIGHTBALL_ANSWERS.length)];
      const embed = new EmbedBuilder()
        .setTitle('🎱 Magic 8-Ball')
        .addFields(
          { name: 'Question', value: question },
          { name: 'Answer', value: answer },
        )
        .setColor(0x2C2F33);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'fact') {
      await interaction.deferReply();
      const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
      const data = await res.json();
      const embed = new EmbedBuilder()
        .setTitle('💡 Random Fact')
        .setDescription(data.text)
        .setColor(0x1ABC9C);
      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'dog') {
      await interaction.deferReply();
      const res = await fetch('https://dog.ceo/api/breeds/image/random');
      const data = await res.json();
      const embed = new EmbedBuilder()
        .setTitle('🐶 Random Dog')
        .setImage(data.message)
        .setColor(0xA0522D);
      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'cat') {
      await interaction.deferReply();
      const res = await fetch('https://api.thecatapi.com/v1/images/search');
      const data = await res.json();
      const embed = new EmbedBuilder()
        .setTitle('🐱 Random Cat')
        .setImage(data[0].url)
        .setColor(0xF4A460);
      await interaction.editReply({ embeds: [embed] });
    }

    else if (commandName === 'color') {
      const hexInput = interaction.options.getString('hex');
      if (!isValidHex(hexInput)) {
        await interaction.reply({ content: 'Invalid hex code. Try something like `#ff0000`.', ephemeral: true });
        return;
      }
      const hex = normalizeHex(hexInput);
      const embed = new EmbedBuilder()
        .setTitle(`🎨 #${hex}`)
        .setColor(parseInt(hex, 16))
        .setThumbnail(`https://singlecolorimage.com/get/${hex}/200x200`)
        .addFields(
          { name: 'HEX', value: `#${hex}`, inline: true },
          { name: 'RGB', value: `${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}`, inline: true },
        );
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'timestamp') {
      const dateStr = interaction.options.getString('date');
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        await interaction.reply({ content: 'Could not parse that date. Try `2026-01-01` or `2026-01-01 14:00`.', ephemeral: true });
        return;
      }
      const unix = Math.floor(parsed.getTime() / 1000);
      const embed = new EmbedBuilder()
        .setTitle('⏱️ Timestamp')
        .setDescription(`Relative: <t:${unix}:R>\nFull date: <t:${unix}:F>\n\nRaw tag: \`<t:${unix}:R>\``)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'qr') {
      const text = interaction.options.getString('url');
      const encoded = encodeURIComponent(text);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
      const embed = new EmbedBuilder()
        .setTitle('📱 QR Code')
        .setImage(qrUrl)
        .setDescription(`[Direct link](${qrUrl})`)
        .setColor(0x000000);
      await interaction.reply({ embeds: [embed] });
    }
  } catch (err) {
    console.error(err);
    const payload = { content: 'Something went wrong running that command.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

registerCommands().then(() => client.login(TOKEN));
