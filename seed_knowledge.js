import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

// 1. Dynamic Embedding Model Finder
async function getActiveEmbeddingModel() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await res.json();
    if (data.models && Array.isArray(data.models)) {
      const embedModel = data.models.find(m => 
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes('embedContent')
      );
      if (embedModel) {
        return embedModel.name.replace('models/', '');
      }
    }
  } catch (e) {
    console.error('⚠️ Could not auto-detect model:', e.message);
  }
  return 'embedding-001';
}

// 2. Generate Embedding
async function getEmbedding(text, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    content: {
      parts: [{ text: text }]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (data.embedding?.values) {
    return data.embedding.values;
  }
  
  throw new Error(data.error?.message || 'Embedding fetch failed');
}

// Business Knowledge Base Data for Make At India & The Alliance Syndicate
const businessKnowledge = [
  {
    topic: "Company Overview and Products",
    content: "Make At India ek trusted Direct Selling organization hai jisme total 4 premium quality products uplabdh hain. Business start karne ke liye kisi bhi 1 product ko choose karke ₹1,999/- se apni ID active ki ja sakti hai."
  },
  {
    topic: "Joining and ID Activation",
    content: "Joining process bilkul simple hai: ₹1,999/- ka product purchase karke member ki unique Direct Selling ID turant activate ho jaati hai, jisse business income ke saare doors open ho jaate hain."
  },
  {
    topic: "Direct Referral Income",
    content: "Direct Income: Jab aap kisi ko direct sponsor karte hain, toh aapko prati vyakti (per person) ₹100/- ki direct income milti hai."
  },
  {
    topic: "Binary Matching Pair Income",
    content: "Pair Income (Binary Matching): 1 Left + 1 Right = 1 Pair Matching par seedhe ₹500/- ka payout banta hai. Aapke network me hone wali har matching par ₹500 milte hain."
  },
  {
    topic: "Daily Capping Limit and Carry Forward",
    content: "Daily Capping: Single ID par daily maximum 20 Pairs matching ki limit hai, yani aap ₹10,000/- prati din (₹3,00,000/mahina) earn kar sakte hain. Baki bache hue extra pairs kabhi flush nahi hote, agle din ke liye Carry Forward ho jaate hain."
  },
  {
    topic: "Tripod Strategy Multiple IDs",
    content: "Multiple ID Strategy (Tripod): 3 IDs (1 Main + 1 Left + 1 Right) lagakar kaam karne se same effort me income 3x (3 guna) multiply ho jaati hai aur daily potential ₹30,000/- tak pahunch jata hai."
  },
  {
    topic: "The Alliance Syndicate Automation System",
    content: "The Alliance Syndicate ek powerful automated ecosystem hai jo 24/7 AI calling aur WhatsApp automated engine provide karta hai. Iska mission 500 existing active/inactive members ko automate karna aur 2,000 naye logon ko onboard karna hai taaki network kabhi na ruke."
  },
  {
    topic: "Syndicate Support and Travel Perks",
    content: "The Alliance Syndicate apne members ko dedicated mentorship, transparent binary tree management, national/international tours aur travel rewards ka pura support provide karta hai."
  },
  {
    topic: "Token Fund and Maintenance Charge",
    content: "Joining sammati ke baad ₹100 token fund lagta hai. Pura AI automation use karne ke liye, jab member ki daily income start ho jaati hai, tab ₹100/day system maintenance charge lagta hai."
  },
  {
    topic: "Next Steps to Join",
    content: "Shuru karne ke liye member apna Naam aur Calling time share kar sakta hai jisse unki ID creation aur product selection process hamari team complete karwaye."
  }
];

async function seedData() {
  console.log('🔍 Active embedding model check kar rahe hain...');
  const activeModel = await getActiveEmbeddingModel();
  console.log(`🎯 Using Embedding Model: [${activeModel}]\n`);

  // Purana table clean karein
  try {
    await supabase.from('knowledge_base').delete().neq('id', 0);
  } catch (e) {}

  for (const item of businessKnowledge) {
    try {
      console.log(`⏳ Embedding generate ho rahi hai: "${item.topic}"...`);
      const embedding = await getEmbedding(`${item.topic}: ${item.content}`, activeModel);

      const { error } = await supabase.from('knowledge_base').insert([
        {
          topic: item.topic,
          content: item.content,
          embedding: embedding
        }
      ]);

      if (error) {
        console.error(`❌ DB Insert Error (${item.topic}):`, error.message);
      } else {
        console.log(`✅ Saved in Supabase: ${item.topic}`);
      }
    } catch (err) {
      console.error(`❌ Failed for [${item.topic}]:`, err.message);
    }
  }

  console.log('\n🎉 Seeding process complete!');
}

seedData();