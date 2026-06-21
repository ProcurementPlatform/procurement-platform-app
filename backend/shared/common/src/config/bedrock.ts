import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import config from './secrets';

// Single shared Bedrock client. Credentials are resolved implicitly from the
// EC2 instance role in production (same pattern as the S3/KMS/SES clients in
// aws.ts) and from the local AWS profile in development. This is the ONLY file
// in the repo that depends on the AWS SDK v3.
const client = new BedrockRuntimeClient({ region: config.bedrock.region });

/**
 * Generate text with the configured Nova text model via the Converse API.
 * Converse is model-agnostic and the recommended interface for Nova models.
 */
export const invokeText = async (
  prompt: string,
  system?: string,
  maxTokens = 1024
): Promise<string> => {
  const command = new ConverseCommand({
    modelId: config.bedrock.textModelId,
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    system: system ? [{ text: system }] : undefined,
    inferenceConfig: { maxTokens, temperature: 0.2, topP: 0.9 },
  });

  const response = await client.send(command);
  const text = response.output?.message?.content?.[0]?.text;
  if (!text) {
    throw new Error('Bedrock returned an empty text response');
  }
  return text.trim();
};

/**
 * Multi-turn variant of invokeText — used by the stateless chat endpoint, which
 * sends the (client-held) conversation history with each request.
 */
export const invokeChat = async (
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  system?: string,
  maxTokens = 1024
): Promise<string> => {
  const command = new ConverseCommand({
    modelId: config.bedrock.textModelId,
    messages: messages.map((m) => ({ role: m.role, content: [{ text: m.content }] })),
    system: system ? [{ text: system }] : undefined,
    inferenceConfig: { maxTokens, temperature: 0.2, topP: 0.9 },
  });

  const response = await client.send(command);
  const text = response.output?.message?.content?.[0]?.text;
  if (!text) {
    throw new Error('Bedrock returned an empty chat response');
  }
  return text.trim();
};

// Build the InvokeModel request body appropriate to the configured embedding
// model. Embeddings are not available through the Converse API, so they use the
// model-native InvokeModel contract. We detect the model family from its id so
// that switching the embedding model (e.g. Nova multimodal ↔ Titan) via env var
// keeps working without a code change.
const buildEmbeddingBody = (modelId: string, text: string): string => {
  if (modelId.includes('titan-embed')) {
    return JSON.stringify({ inputText: text });
  }
  if (modelId.includes('cohere.embed')) {
    return JSON.stringify({ texts: [text], input_type: 'search_document' });
  }
  // Default: Amazon Nova multimodal embeddings contract.
  return JSON.stringify({
    taskType: 'SINGLE_EMBEDDING',
    singleEmbeddingParams: {
      embeddingPurpose: 'GENERIC_INDEX',
      text: { truncationMode: 'END', value: text },
    },
  });
};

// Parse the embedding vector out of whatever response shape the model returns.
const parseEmbedding = (parsed: any): number[] => {
  // Titan: { embedding: [...] }
  if (Array.isArray(parsed?.embedding)) return parsed.embedding;
  // Cohere: { embeddings: [[...]] }
  if (Array.isArray(parsed?.embeddings) && Array.isArray(parsed.embeddings[0])) {
    return parsed.embeddings[0];
  }
  // Nova multimodal: { embeddings: [{ embedding: [...] }] }
  if (Array.isArray(parsed?.embeddings) && Array.isArray(parsed.embeddings[0]?.embedding)) {
    return parsed.embeddings[0].embedding;
  }
  throw new Error('Could not parse an embedding vector from the Bedrock response');
};

/**
 * Produce an embedding vector for a single text chunk using the configured
 * embedding model.
 */
export const invokeEmbedding = async (text: string): Promise<number[]> => {
  const modelId = config.bedrock.embeddingModelId;
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: buildEmbeddingBody(modelId, text),
  });

  const response = await client.send(command);
  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  return parseEmbedding(parsed);
};

export { client as bedrockClient };
