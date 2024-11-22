import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PQueue from 'p-queue';
import { VertexAI } from '@google-cloud/vertexai';

// Set up __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Vertex AI with your Cloud project and location
const vertexAI = new VertexAI({ project: 'gen-lang-client-0106500450', location: 'asia-south1' });
const model = 'gemini-1.5-flash-002';

const generativeModel = vertexAI.preview.getGenerativeModel({
    model: model,
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 1,
        topP: 0.95,
    },
    safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
});

// Sanitize filenames
function sanitizeFilename(name) {
    return name
        .replace(/[^a-zA-Z0-9\s]/g, '-') // Replace non-alphanumeric characters with a hyphen
        .replace(/\s+/g, '-')           // Replace consecutive spaces with a single hyphen
        .replace(/-+/g, '-')            // Replace multiple hyphens with a single hyphen
        .toLowerCase();                 // Convert to lowercase
}

// Save content to a file
function saveToFile(genericName, content) {
    const firstLetter = genericName[0].toLowerCase();
    const directory = path.join(__dirname, firstLetter);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

    const filename = path.join(directory, `${sanitizeFilename(genericName)}.md`);
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`Content saved to "${filename}"`);
}

// Generate content for a single generic name with retries
async function generateContent(genericName, retries = 5) {
    console.log(`Processing: '${genericName}'`);
    const prompt = `
    Generate detailed, professional, and human-like information about the generic "${genericName}" in the format below. The content should be factual, easy to read, and accessible to a wide audience. Avoid using personal references such as "I", "we", or "me." Ensure the tone is natural and not robotic, making the information feel authored by a knowledgeable human. 
    It should not look like an AI-generated content. Make it more human-like, easy to read, and understand. 
    Generic Name: ${genericName}
    Usage: Provide a thorough explanation of the medical conditions and diseases treated by this generic. Include its primary use and any notable secondary uses. The explanation should be clear and suitable for readers seeking both basic and in-depth understanding.
    Dosage: Specify the standard dosage recommendations for adults and children. Include variations based on factors such as age, weight, or severity of the condition. Clearly outline different forms of the medication (e.g., tablet, syrup, injection) and any key administration guidelines or instructions.
    Side Effects: Present a bullet-point list of common side effects, ensuring it is easy to scan. Include any serious but less common side effects and emphasize the need to consult a healthcare provider for guidance if adverse effects occur.
    How it Works: Explain the mechanism of action in straightforward terms while maintaining scientific accuracy. Describe how the drug works in the body and how it addresses the targeted medical condition.
    Precautions: Detail essential precautions, such as contraindications, interactions with other drugs, and specific warnings for vulnerable groups like pregnant women, children, or older adults. Highlight any critical safety measures.
    FAQs: Include a list of frequently asked questions with concise, easy-to-understand answers. Cover topics such as usage, storage, safety, and any common concerns related to this generic.
    `;

    const request = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Generating content for "${genericName}" (Attempt ${attempt})`);
            const streamingResponse = await generativeModel.generateContentStream(request);
            let content = '';
            let tokensUsed = 0; // Initialize token counter

            for await (const item of streamingResponse.stream) {
                if (item?.candidates?.[0]?.content?.parts) {
                    content += item.candidates[0].content.parts.map(part => part.text).join('');
                }
                if (item?.candidates?.[0]?.metadata?.totalTokensUsed) {
                    tokensUsed = item.candidates[0].metadata.totalTokensUsed;
                }
            }

            if (!content.trim()) throw new Error(`No content generated for "${genericName}"`);

            console.log(`Tokens used for "${genericName}": ${tokensUsed}`); // Print token usage

            const yamlHeader = `---
layout: minimal-medicine
title: ${genericName}
---

# ${genericName}

`;
            saveToFile(genericName, yamlHeader + content);
            return; // Exit function on success
        } catch (error) {
            if (error.code === 429 && attempt < retries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.error(`Rate limit hit for "${genericName}". Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`Failed to generate content for "${genericName}" after ${attempt} attempts:`, error.message);
                break;
            }
        }
    }
}


// Process the input file using PQueue for concurrency
async function processGenericsFile() {
    const filePath = 'generics.txt';
    if (!fs.existsSync(filePath)) {
        console.error('Input file "generics.txt" not found. Please provide the file and try again.');
        process.exit(1);
    }    

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const genericNames = data.split('\n').map(name => name.trim()).filter(Boolean);


        const queue = new PQueue({ concurrency: 5 }); // Adjust concurrency as needed
        console.log(`Processing ${genericNames.length} generics with concurrency: ${queue.concurrency}`);

        genericNames.forEach(genericName => {
            queue.add(() => generateContent(genericName.replace(/[()"']/g, '').replace(/,/g, ' +')));
        });

        await queue.onIdle(); // Wait until all tasks are completed
        console.log('All generics processed successfully.');
    } catch (error) {
        console.error('Error processing generics file:', error.message);
    }
}

// Main function
(async function main() {
    console.log('Starting processing of generics...');
    await processGenericsFile();
    console.log('Processing completed.');
})();
