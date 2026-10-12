const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

// Pre-Saved Manuals Library (Stored locally in code)
const MANUALS_LIBRARY = {
  ticket_tool: "https://notion.so/rosalia/manuals/ticket-tool-guide",
  carl_bot: "https://notion.so/rosalia/manuals/carl-bot-reaction-roles",
  automod: "https://notion.so/rosalia/manuals/discord-automod-setup"
};

// In-Memory Database for active client tracking
const clientRequests = [];

// Helper: Generates Unique Ticket Code (e.g., ROS-7391)
function generateTicketCode() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ROS-${randomNum}`;
}

// Helper: Generates Dynamic Server Template for Brand New Servers
function generateServerTemplate(category) {
  const templates = {
    "Gaming": "https://discord.new/gaming-community-rosalia-template",
    "Creator": "https://discord.new/creator-lounge-rosalia-template",
    "Community": "https://discord.new/community-hub-rosalia-template",
    "Business": "https://discord.new/business-professional-rosalia-template"
  };
  return templates[category] || "https://discord.new/general-rosalia-template";
}

// API Endpoint 1: Submit Client Request Form
app.post('/api/request', async (req, res) => {
  try {
    const { discordUser, serverName, serviceType, serverCategory, selectedBots, extraNotes } = req.body;

    if (!discordUser || !serverName) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    const ticketCode = generateTicketCode();
    const isBrandNew = serviceType && serviceType.toLowerCase().includes("brand new");
    
    // Generate Template Link if it's a brand new server
    const templateLink = isBrandNew ? generateServerTemplate(serverCategory) : null;

    // Create Action Checklist based on request details
    const checklist = [
      { id: 1, task: "Clean & Audit Channel Structure", completed: false },
      { id: 2, task: "Set Up Role Permissions & Colors", completed: false },
      { id: 3, task: `Configure Requested Bots (${Array.isArray(selectedBots) ? selectedBots.join(', ') : 'Standard'})`, completed: false },
      { id: 4, task: "Set Up Native Discord Onboarding", completed: false },
      { id: 5, task: "Final Review & Client Handover", completed: false }
    ];

    const requestRecord = {
      ticketCode,
      discordUser,
      serverName,
      serviceType: serviceType || "Remodel",
      serverCategory: serverCategory || "Community",
      selectedBots: selectedBots || [],
      extraNotes: extraNotes || "None",
      accessGranted: false,
      progressPercent: 0,
      checklist,
      templateLink,
      createdAt: new Date().toISOString()
    };

    clientRequests.push(requestRecord);

    // Send payload to Discord via Bot REST API
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

    if (BOT_TOKEN && CHANNEL_ID) {
      const embed = {
        title: `🌹 New Request Received [${ticketCode}]`,
        color: isBrandNew ? 0xE8C5C8 : 0xC98B8B,
        fields: [
          { name: "💬 Client Discord Tag", value: discordUser, inline: true },
          { name: "🏰 Server Name", value: serverName, inline: true },
          { name: "🛠️ Service Type", value: serviceType, inline: true },
          { name: "🏷️ Category", value: serverCategory, inline: true },
          { name: "🤖 Requested Bots", value: Array.isArray(selectedBots) ? selectedBots.join(", ") : "None" },
          { name: "📝 Extra Notes", value: extraNotes || "None" }
        ],
        footer: { text: "Rosalia Discord Architecture • Screenshot & Send to urstruly.megs" },
        timestamp: new Date().toISOString()
      };

      if (templateLink) {
        embed.fields.push({ name: "🔗 Auto-Generated Template", value: `[Click to Deploy Template](${templateLink})` });
      }

      await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ embeds: [embed] })
      });
    }

    return res.status(200).json({
      success: true,
      ticketCode,
      instructions: "Take a screenshot of this ticket screen and send it to urstruly.megs alongside a friend request on Discord.",
      templateLink
    });

  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// API Endpoint 2: Admin Progress Bar & Task Checklist Update
app.post('/api/admin/update-progress', (req, res) => {
  const { ticketCode, taskId, completed } = req.body;
  const record = clientRequests.find(r => r.ticketCode === ticketCode);

  if (!record) {
    return res.status(404).json({ success: false, message: "Ticket code not found." });
  }

  const task = record.checklist.find(t => t.id === taskId);
  if (task) {
    task.completed = completed;
  }

  // Calculate dynamic progress percentage
  const completedCount = record.checklist.filter(t => t.completed).length;
  record.progressPercent = Math.round((completedCount / record.checklist.length) * 100);

  return res.status(200).json({
    success: true,
    progressPercent: record.progressPercent,
    checklist: record.checklist
  });
});

// API Endpoint 3: Send Pre-Saved Manual to Client via Bot Direct Message
app.post('/api/admin/send-manual', async (req, res) => {
  const { clientDiscordId, manualKey } = req.body;
  const manualUrl = MANUALS_LIBRARY[manualKey];

  if (!manualUrl) {
    return res.status(400).json({ success: false, message: "Invalid manual key." });
  }

  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

  try {
    // 1. Create DM Channel with client
    const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: clientDiscordId })
    });
    const dmChannel = await dmChannelRes.json();

    // 2. Post Manual Guide Embed directly to client
    await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: `🌹 **Rosalia Manual Access Granted!**\nHere is your requested setup guide: ${manualUrl}`
      })
    });

    return res.status(200).json({ success: true, message: "Manual dispatched via Bot DM!" });
  } catch (err) {
    console.error("Failed to DM client:", err);
    return res.status(500).json({ success: false, message: "Could not send DM to client." });
  }
});

// Serve root homepage
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🌹 Rosalia engine running on port ${PORT}`));