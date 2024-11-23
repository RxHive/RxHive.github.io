const fs = require('fs');
const path = require('path');

const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Vertex AI with your Cloud project and location
const vertex_ai = new VertexAI({ project: 'gen-lang-client-0106500450', location: 'asia-south1' });
const model = 'gemini-1.5-flash-002';

const generativeModel = vertex_ai.preview.getGenerativeModel({
    model: model,
    generationConfig: {
        maxOutputTokens: 8192,
        temperature: 1,
        topP: 0.95,
    },
    safetySettings: [
        {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
        },
        {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
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

// Generate content and write to a .md file
async function generateContentForGeneric(genericName, retries = 3) {
    const prompt = `
Provide details about the generic ${genericName} in the following format:

Generic Name:
Usage:
Side Effects:
How it Works:
FAQs:
`;

    const req = {
        contents: [
            { role: 'user', parts: [{ text: prompt }] },
        ],
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const streamingResp = await generativeModel.generateContentStream(req);
            let generatedContent = '';

            // Process the streaming response
            for await (const item of streamingResp.stream) {
                if (item && item.candidates && item.candidates[0].content.parts) {
                    generatedContent += item.candidates[0].content.parts.map(part => part.text).join('');
                }
            }

            // Check if content was generated
            if (!generatedContent.trim()) {
                throw new Error(`No content generated for ${genericName}`);
            }

            // Add disclaimer
            generatedContent += `\n\n**Note:** This information is AI-generated or crowd-sourced and may not be accurate. Please consult a medical professional for verified advice.`;

            // Create the YAML front matter and header
            const yamlFrontMatter = `---
layout: minimal-medicine
nav_exclude: true
title: ${genericName}
---

# ${genericName}

`;

            // Combine YAML, header, and generated content
            const fileContent = yamlFrontMatter + generatedContent;
            const firstLetter = genericName[0].toLowerCase();
            const directory = path.join(__dirname, firstLetter);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true }); // Create the directory if it doesn't exist
            }

            // Write the file to the determined directory
            const filename = path.join(directory, `${sanitizeFilename(genericName)}.md`);
            fs.writeFileSync(filename, fileContent, 'utf8');

            console.log(`Content successfully written to ${filename}`);
            return; // Exit the function on success

            return; // Exit the function on success
        } catch (error) {
            console.error(`Attempt ${attempt} failed for '${genericName}':`, error.message);

            // If all attempts fail, throw the error
            if (attempt === retries) {
                console.error(`All attempts failed for '${genericName}'.`);
                return;
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
}

// Process the file and generate markdown files in parallel
async function processGenericsFile() {
    const filePath = 'generics.txt';
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const genericNames = data.split('\n').map(line => line.trim()).filter(line => line);

        const batchSize = 5; // Number of parallel connections
        for (let i = 0; i < genericNames.length; i += batchSize) {
            const batch = genericNames.slice(i, i + batchSize);
            console.log(`Processing batch: ${batch.join(', ')}`);

            await Promise.all(
                batch.map(async (genericName) => {
                    const sanitizedName = genericName.replace(/[()"']/g, '').replace(/,/g, ' +');
                    console.log(`Processing: '${sanitizedName}'`);
                    await generateContentForGeneric(sanitizedName);
                })
            );

            // Optional: Add a delay between batches if needed
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('All generics processed successfully.');
    } catch (error) {
        console.error('Error reading or processing the generics file:', error.message);
    }
}

// Start processing
processGenericsFile();
