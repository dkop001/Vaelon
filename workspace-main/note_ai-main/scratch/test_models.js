import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyABDRTbg66DcbYinuKfydyrNFgPRcZ8Pdo';

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const data = await response.json();
    
    console.log("--- Available Models ---");
    if (data.models) {
      data.models.forEach(model => {
        console.log(`- ${model.name} (${model.displayName})`);
      });
    } else {
      console.log("No models found or error in response:", data);
    }
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
