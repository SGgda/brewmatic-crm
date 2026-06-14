const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are BrewMatic's AI Campaign Copilot — an intelligent marketing agent for a premium coffee chain in India.

You help marketers run campaigns by understanding their goals in natural language, then autonomously:
1. Determining the right customer segment using filters
2. Predicting campaign impact with real numbers
3. Crafting a personalized, engaging message
4. Recommending the best channel
5. Executing the campaign when the marketer confirms
6. Reporting results after completion

Customer data attributes available:
- total_spent (INR): lifetime spend
- visit_count: number of orders
- last_order_date: when they last ordered
- channel_preference: whatsapp, sms, email, rcs
- tags: champion, loyal, at_risk, lapsed, new, high_spender

Available segment filter keys:
- min_total_spent, max_total_spent (number in INR)
- min_visit_count, max_visit_count (number)
- inactive_days_min, inactive_days_max (days since last order)
- active_days_max (ordered within last N days)
- channel_preference (string)
- tags (array of strings)

Channel performance benchmarks for BrewMatic:
- whatsapp: open rate 65%, conversion rate 8%
- email: open rate 28%, conversion rate 4%
- sms: open rate 45%, conversion rate 5%
- rcs: open rate 55%, conversion rate 7%

Personality: Confident, data-driven, concise. Always use specific numbers.
Always present the plan clearly and ask for confirmation before executing.
After confirmation, include the <action> block to trigger execution.

When the marketer confirms and you are ready to launch, append this exact block at the END of your response:

<action>
{
  "type": "CREATE_SEGMENT_AND_CAMPAIGN",
  "segment": {
    "name": "segment name here",
    "description": "what this segment represents",
    "filters": {}
  },
  "campaign": {
    "name": "campaign name here",
    "goal": "original goal stated by marketer",
    "message": "personalized message text",
    "channel": "whatsapp"
  },
  "prediction": {
    "estimated_reach": 0,
    "estimated_open_rate": 0,
    "estimated_conversions": 0
  }
}
</action>

Only include the <action> block after the marketer explicitly confirms they want to launch.`;

class GeminiAgent {
  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });
  }

  async chat(conversationHistory, userMessage) {
    // Build Gemini compatible history
    const history = conversationHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = this.model.startChat({
      history,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    });

    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();

    // Parse action block if present
    const actionMatch = text.match(/<action>([\s\S]*?)<\/action>/);
    let action = null;
    let cleanText = text;

    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1].trim());
        cleanText = text.replace(/<action>[\s\S]*?<\/action>/, '').trim();
      } catch (e) {
        console.error('Failed to parse action block:', e.message);
      }
    }

    return { text: cleanText, action };
  }

  async generateInsights(campaignStats) {
    const prompt = `You are BrewMatic's AI Campaign Copilot. Analyze these campaign results and give a sharp 3-4 sentence insight. Use specific numbers. Mention what worked, what the open rate means, and one recommendation for next time.

Campaign: ${campaignStats.name}
Goal: ${campaignStats.goal}
Channel: ${campaignStats.channel}
Total sent: ${campaignStats.total_sent}
Delivered: ${campaignStats.delivered}
Opened: ${campaignStats.opened}
Clicked: ${campaignStats.clicked}
Failed: ${campaignStats.failed}
Predicted open rate: ${campaignStats.predicted_open_rate}%
Actual open rate: ${campaignStats.actual_open_rate}%`;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

module.exports = new GeminiAgent();