import { z } from 'zod';


//
// Implementation notes (see https://platform.openai.com/docs/changelog for upstream changes):
// - 2024-12-17: "Reasoning Effort" - added reasoning_effort and the 'developer' message role
// - 2024-11-05: "Predicted Outputs"
// - 2024-10-17: "gpt-4o-audio-preview" - not fully added: "Audio inputs and outputs are now available in the Chat Completions API" - TBA
// - 2024-10-01: "DevDay" - added prompt_tokens_details, audio_tokens, and refusal messages
// - 2024-09-12: "o1" - max_tokens is deprecated in favor of max_completion_tokens, added completion_tokens_details
// - 2024-08-06: "Structured Outputs" - added JSON Schema and strict schema adherence
// - 2024-07-09: skipping Functions as they're deprecated
// - 2024-07-09: ignoring logprobs
// - 2024-07-09: ignoring the advanced model configuration
//


export namespace OpenAIWire_ContentParts {

  /// Content parts - Input

  export type TextContentPart = z.infer<typeof TextContentPart_schema>;
  const TextContentPart_schema = z.object({
    type: z.literal('text'),
    text: z.string(),
  });

  const ImageContentPart_schema = z.object({
    type: z.literal('image_url'),
    image_url: z.object({
      // Either a URL of the image or the base64 encoded image data.
      url: z.string(),
      // Control how the model processes the image and generates its textual understanding.
      // https://platform.openai.com/docs/guides/vision/low-or-high-fidelity-image-understanding
      detail: z.enum(['auto', 'low', 'high']).optional(),
    }),
  });

  const OpenAI_AudioContentPart_schema = z.object({
    // [OpenAI, 2024-10-17] input content: audio
    type: z.literal('input_audio'),
    input_audio: z.object({
      // Base64 encoded audio data.
      data: z.string(),
      // The format of the encoded audio data. Currently supports "wav" and "mp3".
      format: z.enum(['wav', 'mp3']),
    }),
  });

  export const ContentPart_schema = z.discriminatedUnion('type', [
    TextContentPart_schema,
    ImageContentPart_schema,
    OpenAI_AudioContentPart_schema,
  ]);

  export function TextContentPart(text: string): z.infer<typeof TextContentPart_schema> {
    return { type: 'text', text };
  }

  export function ImageContentPart(url: string, detail?: 'auto' | 'low' | 'high'): z.infer<typeof ImageContentPart_schema> {
    return { type: 'image_url', image_url: { url, detail } };
  }

  export function OpenAI_AudioContentPart(data: string, format: 'wav' | 'mp3'): z.infer<typeof OpenAI_AudioContentPart_schema> {
    return { type: 'input_audio', input_audio: { data, format } };
  }

  /// Content parts - Output

  const PredictedFunctionCall_schema = z.object({
    /*
     * .optional: for Mistral non-streaming generation - this is fairly weak, and does not let the discriminator work;
     *            please remove this hack asap.
     */
    type: z.literal('function').optional(),
    id: z.string(),
    function: z.object({
      name: z.string(),
      /**
       * Note that the model does not always generate valid JSON, and may hallucinate parameters
       * not defined by your function schema.
       * Validate the arguments in your code before calling your function.
       */
      arguments: z.string(),
    }),
  });

  export function PredictedFunctionCall(toolCallId: string, functionName: string, functionArgs: string): z.infer<typeof PredictedFunctionCall_schema> {
    return { type: 'function', id: toolCallId, function: { name: functionName, arguments: functionArgs } };
  }

  export const ToolCall_schema = z.discriminatedUnion('type', [
    PredictedFunctionCall_schema,
  ]);

  /// Annotation - Output - maybe not even content parts

  export const OpenAI_AnnotationObject_schema = z.object({
    type: z.literal('url_citation'),
    url_citation: z.object({
      start_index: z.number().optional(),
      end_index: z.number().optional(),
      title: z.string(),
      url: z.string(),
    }),
  });

}

export namespace OpenAIWire_Messages {

  /// Messages - Input

  // const _optionalParticipantName = z.string().optional();

  const SystemMessage_schema = z.object({
    role: z.literal('system'),
    content: z.string(),
    // name: _optionalParticipantName,
  });

  const OpenAI_DeveloperMessage_schema = z.object({
    // [OpenAI, 2024-12-17] The developer message
    role: z.literal('developer'),
    content: z.string(), // Note: content could be an unspecified 'array' according to the docs, but we constrain it to string here
    // name: _optionalParticipantName,
  });

  const UserMessage_schema = z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(OpenAIWire_ContentParts.ContentPart_schema)]),
    // name: _optionalParticipantName,
  });

  export const AssistantMessage_schema = z.object({
    role: z.literal('assistant'),
    /**
     * The contents of the assistant message. Required unless tool_calls or function_call is specified.
     *
     * NOTE: the assistant message is also extending to be an array, but as of 2024-12-24, it's not important
     *       enough to require array support. The documentation of the array[] behavior of the field is:
     *       "An array of content parts with a defined type. Can be one or more of type text, or exactly one of type refusal."
     */
    content: z.string().nullable(),
    /**
     * The tool calls generated by the model, such as function calls.
     */
    tool_calls: z.array(OpenAIWire_ContentParts.ToolCall_schema).optional()
      .nullable(), // [Mistral] added .nullable()
    /**
     * [OpenAI, 2024-10-01] The refusal message generated by the model.
     */
    refusal: z.string().nullable().optional(),
    /**
     * [OpenAI, 2024-10-17] Data about a previous audio response from the model. Usage depends on the context:
     * - request (this schema): has an id, if present
     * - non-streaming response: has the generated audio and some metadata
     * - streaming response: NO audio fields
     */
    audio: z.object({
      id: z.string(),
    }).nullable().optional(),

    /**
     * [OpenRouter, 2025-06-05] The reasoning text generated by the model (e.g. with Anthropic thinking requests).
     */
    reasoning: z.string().nullable().optional(),

    // function_call: // ignored, as it's deprecated
    // name: _optionalParticipantName, // omitted by choice: generally unsupported
  });

  const ToolMessage_schema = z.object({
    role: z.literal('tool'),
    content: z.string(),
    tool_call_id: z.string(),
  });

  export function ToolMessage(toolCallId: string, content: string): z.infer<typeof ToolMessage_schema> {
    return { role: 'tool', content, tool_call_id: toolCallId };
  }

  export const Message_schema = z.discriminatedUnion('role', [
    SystemMessage_schema,
    OpenAI_DeveloperMessage_schema,
    UserMessage_schema,
    AssistantMessage_schema,
    ToolMessage_schema,
  ]);

}

export namespace OpenAIWire_Tools {

  /// Tool definitions - Input

  export type FunctionDefinition = z.infer<typeof FunctionDefinition_schema>;
  export const FunctionDefinition_schema = z.object({
    /**
     * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
     */
    name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, {
      message: 'Tool name must be 1-64 characters long and contain only letters, numbers, underscores, and hyphens',
    }),
    /**
     * A description of what the function does, used by the model to choose when and how to call the function.
     */
    description: z.string().optional(),
    /**
     * The parameters the functions accepts, described as a JSON Schema object.
     * Omitting parameters defines a function with an empty parameter list.
     */
    parameters: z.object({
      type: z.literal('object'),
      /**
       * For stricter validation, use the OpenAPI_Schema.Object_schema
       */
      properties: z.record(z.any()).optional(),
      required: z.array(z.string()).optional(),
    }).optional(),
    /**
     * [OpenAI Structured Outputs, 2024-08-06]
     * Whether to enable strict schema adherence when generating the function call. Defaults to false.
     * [OpenAI] Only a subset of the schema would be supported and enforced.
     */
    strict: z.boolean().optional(),
  });

  export const ToolDefinition_schema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('function'),
      function: FunctionDefinition_schema,
    }),
  ]);

  export const ToolChoice_schema = z.union([
    z.literal('none'), // Do not use any tools
    z.literal('auto'), // Let the model decide whether to use tools or generate content
    z.literal('required'), // Must call one or more
    z.object({
      type: z.literal('function'),
      function: z.object({ name: z.string() }),
    }),
    // [Mistral] Mistral only, requires an 'any' value
    // Commented because we'll disable Mistral function calling instead
    // z.literal('any'),
  ]);

}


//
// Chat > Create chat completion
//
export namespace OpenAIWire_API_Chat_Completions {

  /// Request

  export type Request = z.infer<typeof Request_schema>;
  export const Request_schema = z.object({

    // basic input
    model: z.string(),
    messages: z.array(OpenAIWire_Messages.Message_schema),

    // tool definitions and calling policy
    tools: z.array(OpenAIWire_Tools.ToolDefinition_schema).optional(),
    tool_choice: OpenAIWire_Tools.ToolChoice_schema.optional(),
    parallel_tool_calls: z.boolean().optional(), // defaults to true

    // common model configuration
    max_completion_tokens: z.number().int().positive().optional(), // [OpenAI o1, 2024-09-12]
    max_tokens: z.number().optional(), // Deprecated in favor of max_completion_tokens - but still used by pre-o1 models and OpenAI-compatible APIs
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),

    // new output modalities
    modalities: z.array(z.enum(['text', 'audio'])).optional(), // defaults to ['text']
    audio: z.object({  // Parameters for audio output. Required when audio output is requested with `modalities: ["audio"]`
      voice: z.enum([
        'ash', 'ballad', 'coral', 'sage', 'verse', // recommended
        'alloy', 'echo', 'shimmer', // discouraged
      ]),
      format: z.enum(['wav', 'mp3', 'flac', 'opus', 'pcm16']),
    }).optional(),

    // API configuration
    n: z.number().int().positive().optional(), // Defaults to 1, as the derived-ecosystem does not support it
    stream: z.boolean().optional(), // If set, partial message deltas will be sent, with the stream terminated by a `data: [DONE]` message.
    stream_options: z.object({
      include_usage: z.boolean().optional(), // If set, an additional chunk will be streamed with a 'usage' field on the entire request.
    }).optional(),
    reasoning_effort: z.enum(['low', 'medium', 'high']).optional(), // [OpenAI, 2024-12-17] reasoning effort, o1 models only for now
    include_reasoning: z.boolean().optional(), // [OpenRouter, 2025-01-24] enables reasoning tokens
    reasoning: z.object({ // [OpenRouter, 2025-06-05] Reasoning parameter for Claude models
      max_tokens: z.number().int().positive(),
    }).optional(),
    prediction: z.object({ // [OpenAI, 2024-11-05] Predicted Outputs - for regenerating a file with only minor changes to most of the content.
      type: z.literal('content'),
      content: z.union([z.string(), z.array(OpenAIWire_ContentParts.ContentPart_schema)]),
    }).optional(),
    response_format: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('text'), // Default
      }),
      /**
       * When using JSON mode, you must also instruct the model to produce JSON
       * yourself via a system or user message. Without this, the model may generate
       * an unending stream of whitespace until the generation reaches the token limit,
       * resulting in a long-running and seemingly "stuck" request.
       *
       * Also note that the message content may be partially cut off if
       * finish_reason="length", which indicates the generation exceeded max_tokens or
       * the conversation exceeded the max context length.
       */
      z.object({
        type: z.literal('json_object'),
      }),
      /**
       * [OpenAI Structured Outputs, 2024-08-06]
       * Whether to enable strict schema adherence when generating the output.
       * If set to true, the model will always follow the exact schema defined
       * in the schema field.
       * Only a subset of JSON Schema is supported when strict is true.
       */
      z.object({
        type: z.literal('json_schema'),
        json_schema: z.object({
          name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
          description: z.string().optional(),
          schema: z.record(z.any()).optional(),
          strict: z.boolean().optional().default(false),
        }),
      }),
    ]).optional(),
    web_search_options: z.object({
      /**
       * High level guidance for the amount of context window space to use for the search. One of low, medium, or high. medium is the default.
       */
      search_context_size: z.enum(['low', 'medium', 'high']).optional(),
      /**
       * Approximate location parameters for the search.
       */
      user_location: z.object({
        type: z.literal('approximate'),
        approximate: z.object({
          city: z.string().optional(),      // free text for the city of the user, e.g. 'San Francisco'
          country: z.string().optional(),   // two-letter ISO country code of the user, e.g. 'US'
          region: z.string().optional(),    // free text, e.g. 'California'
          timezone: z.string().optional(),  // IANA timezone of the user, e.g. 'America/Los_Angeles'
        }),
      }).nullable().optional(),
    }).optional(),

    seed: z.number().int().optional(),
    stop: z.array(z.string()).optional(), // Up to 4 sequences where the API will stop generating further tokens.
    user: z.string().optional(),

    // (deprecated upstream, OMITTED BY CHOICE): function_call and functions

    // (OMITTED BY CHOICE) advanced model configuration
    // frequency_penalty: z.number().min(-2).max(2).optional(), // Defaults to 0
    // presence_penalty: z.number().min(-2).max(2).optional(),  // Defaults to 0
    // logit_bias: z.record(z.number()).optional(),
    // logprobs: z.boolean().optional(), // Defaults to false
    // top_logprobs: z.number().int().min(0).max(20).optional(),

    // (OMITTED BY CHOICE) advanced API configuration
    // store: z.boolean().optional(), // Defaults to false. Whether or not to store the output of this chat completion request for use in our model distillation or evals products.
    // metadata: z.record(z.any()).optional(), // Developer-defined tags and values used for filtering completions in [the dashboard](https://platform.openai.com/completions)
    // service_tier: z.string().optional(),

  });

  /// Response

  const FinishReason_Enum = z.enum([
    'stop', // natural completion, or stop sequence hit
    'length', // max_tokens exceeded
    'tool_calls', // the model called a tool
    'content_filter', // upstream content was omitted due to a flag from content filters

    // Disabling Function Call, OMITTED BY CHOICE
    // 'function_call', // (deprecated) the model called a function

    // Extensions // disabled: we now use a string union to accept any value without breaking
    // '', // [LocalAI] bad response from LocalAI which breaks the parser
    // 'COMPLETE', // [OpenRouter->Command-R+]
    // 'STOP', // [OpenRouter->Gemini]
    // 'end_turn', // [OpenRouter->Anthropic]
    // 'eos', // [OpenRouter->Phind]
    // 'error', // [OpenRouter] their network error
    // 'stop_sequence', // [OpenRouter->Anthropic] added 'stop_sequence' which is the same as 'stop'
  ]);

  const Usage_schema = z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),

    // [OpenAI, 2024-10-01] breaks down the input tokens into components
    prompt_tokens_details: z.object({
      audio_tokens: z.number().optional(),
      cached_tokens: z.number().optional(),
    }).optional()
      .nullable(), // [2025-06-02] Chutes.ai using slang server returns null for prompt_tokens_details

    // [OpenAI o1, 2024-09-12] breaks down the completion tokens into components
    completion_tokens_details: z.object({
      reasoning_tokens: z.number().optional(), // [Discord, 2024-04-10] reported missing
      // text_tokens: z.number().optional(), // [Discord, 2024-04-10] revealed as present on custom OpenAI endpoint - not using it here yet
      audio_tokens: z.number().optional(), // [OpenAI, 2024-10-01] audio tokens used in the completion (charged at a different rate)
      accepted_prediction_tokens: z.number().optional(), // [OpenAI, 2024-11-05] Predicted Outputs
      rejected_prediction_tokens: z.number().optional(), // [OpenAI, 2024-11-05] Predicted Outputs
    }).optional() // not present in other APIs yet
      .nullable(), // [2025-06-02] no issues yet, but preventive

    // [DeepSeek, 2024-08-02] context caching on disk
    prompt_cache_hit_tokens: z.number().optional(),
    prompt_cache_miss_tokens: z.number().optional(),
  }).nullable();

  /**
   * NOTE: this is effectively the OUTPUT message (from the Chat Completion output object).
   * - 2025-03-11: the docs show that 'role' is not mandated to be 'assistant' anymore and could be different
   */
  const ChoiceMessage_NS_schema = OpenAIWire_Messages.AssistantMessage_schema.extend({
    //
    // IMPORTANT - this message *extends* the AssistantMessage_schema, to inherit all fields while performing any other change
    //

    // .string, instead of .assistant -- but we keep it strict for now, for parser correctness
    // role: z.string(),

    // .optional: when parsing a non-streaming message with just a FC, the content can be missing
    content: z.string().nullable().optional(),

    /**
     * [OpenAI, 2025-03-11] Annotations
     * This is a full assistant message, which is parsed by the non-streaming parser.
     */
    annotations: z.array(OpenAIWire_ContentParts.OpenAI_AnnotationObject_schema).nullable().optional(),

    /**
     * [OpenAI, 2024-10-17] Audio output (non-streaming only)
     * If the audio output modality is requested, this object contains data about the audio response from the model
     */
    audio: z.object({
      id: z.string(),
      data: z.string(), // Base64 encoded audio data
      expires_at: z.number(), // Unix timestamp
      transcript: z.string().optional(),
    }).nullable().optional(),

  });

  const Choice_NS_schema = z.object({
    index: z.number(),

    // NOTE: the OpenAI api does not force role: 'assistant', it's only induced
    // We recycle the assistant message response here, with either content or tool_calls
    message: ChoiceMessage_NS_schema,

    finish_reason: z.union([FinishReason_Enum, z.string()])
      .nullable(),

    // (OMITTED BY CHOICE) We will not support logprobs for now, so it's disabled here and in the request
    // logprobs: z.any().nullable().optional() // Log probability information for the choice.
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    object: z.literal('chat.completion'),
    id: z.string(), // A unique identifier for the chat completion.

    /**
     * A list of chat completion choices. Can be more than one if n is greater than 1.
     */
    choices: z.array(Choice_NS_schema),

    model: z.string(), // The model used for the chat completion.
    usage: Usage_schema.optional(), // If requested
    created: z.number(), // The Unix timestamp (in seconds) of when the chat completion was created.
    system_fingerprint: z.string().optional() // The backend configuration that the model runs with.
      .nullable(), // [Groq, undocumented OpenAI] fingerprint is null on some OpenAI examples too
    // service_tier: z.string().optional().nullable(), // OMITTED BY CHOICE

    // undocumented messages that are not part of the official schema, but can be found when the server sends and error
    error: z.any().optional(),
    warning: z.unknown().optional(),

    // [Perplexity] String array of citations, the first element is the first reference, i.e. '[1]'.
    citations: z.array(z.any()).optional(),
  });

  /// Streaming Response

  const _UndocumentedError_schema = z.object({
    // (undocumented) first experienced on 2023-06-19 on streaming APIs
    message: z.string().optional(),
    type: z.string().optional(),
    param: z.string().nullable().optional(),
    code: z.string().nullable().optional()
      .or(z.number()), // [OpenRouter, 2024-11-21] code can be a number too

    // [OpenRouter, 2024-11-21] OpenRouter can have an additional 'metadata' field
    metadata: z.record(z.any()).optional(),
  });

  const _UndocumentedWarning_schema = z.string();

  /* Note: this is like the predicted function call, but with fields optional,
     as after the first chunk (which carries type and id), the model will just emit
     some index and function.arguments

     Note2: we found issues with Together, Openrouter, Mistral, and others we don't remember
     This object's status is really a mess for OpenAI and their downstream 'compatibles'.
   */
  const ChunkDeltaToolCalls_schema = z.object({
    index: z.number() // index is not present in non-streaming calls
      .optional(), // [Mistral] not present

    type: z.literal('function').optional(), // currently (2024-10-01) only 'function' is supported

    id: z.string().optional(), // id of the tool call - set likely only in the first chunk

    function: z.object({
      /**
       * Empirical observations:
       * - the name field seems to be set, in full, in the first call
       * - [TogetherAI] added .nullable() - exclusive with 'arguments'
       */
      name: z.string().optional().nullable(),
      /**
       * Note that the model does not always generate valid JSON, and may hallucinate parameters
       * not defined by your function schema.
       * Validate the arguments in your code before calling your function.
       * [TogetherAI] added .nullable() - exclusive with 'name'
       */
      arguments: z.string().optional().nullable(),
    }),
  });

  const ChunkDelta_schema = z.object({
    role: z.literal('assistant').optional()
      .nullable(), // [Deepseek] added .nullable()
    // delta-text content
    content: z.string().nullable().optional(),
    // delta-reasoning content
    reasoning_content: z.string().nullable().optional(), // [Deepseek, 2025-01-20]
    reasoning: z.string().optional() // [OpenRouter, 2025-01-24]
      .nullable(), // [OpenRouter, 2025-06-05] null on Anthropic text responses past the reasoning blocks
    // delta-tool-calls content
    tool_calls: z.array(ChunkDeltaToolCalls_schema).optional()
      .nullable(), // [TogetherAI] added .nullable(), see https://github.com/togethercomputer/together-python/issues/160
    refusal: z.string().nullable().optional(), // [OpenAI, 2024-10-01] refusal message
    /**
     * [OpenAI, 2025-03-11] Annotations
     * not documented yet in the API guide; shall improve this once defined
     */
    annotations: z.array(OpenAIWire_ContentParts.OpenAI_AnnotationObject_schema).optional(),
  });

  const ChunkChoice_schema = z.object({
    index: z.number()
      .optional(), // [OpenRouter] added .optional() which implies index=0 I guess

    // A chat completion delta generated by streamed model responses.
    delta: ChunkDelta_schema,

    finish_reason: z.union([FinishReason_Enum, z.string()])
      .nullable()   // very common, e.g. Azure
      .optional(),  // [OpenRouter] added .optional() which only has the delta field in the whole chunk choice

    // (OMITTED BY CHOICE) We will not support logprobs for now, so it's disabled here and in the request
    // logprobs: z.any().nullable().optional() // Log probability information for the choice.
  });

  export const ChunkResponse_schema = z.object({
    object: z.enum([
      'chat.completion.chunk',
      'chat.completion', // [Perplexity] sent an email on 2024-07-14 to inform them about the misnomer
      '', // [Azure] bad response: the first packet communicates 'prompt_filter_results'
    ])
      .optional(), // [FastAPI, 2025-04-24] the FastAPI dialect sadly misses the 'chat.completion.chunk' type
    id: z.string(),

    /**
     * A list of chat completion choices.
     * Can contain more than one elements if n is greater than 1.
     * Can also be empty for the last chunk if you set stream_options: {"include_usage": true}
     */
    choices: z.array(ChunkChoice_schema),

    model: z.string(), // The model used for the chat completion.
    usage: Usage_schema.optional(), // If requested
    created: z.number() // The Unix timestamp (in seconds) of when the chat completion was created.
      .optional(), // [FastAPI, 2025-04-24] the FastAPI dialect sadly misses the 'created' field
    system_fingerprint: z.string().optional() // The backend configuration that the model runs with.
      .nullable(), // [Grow, undocumented OpenAI] fingerprint is null on some OpenAI examples too
    // service_tier: z.unknown().optional(),

    // [OpenAI] undocumented streaming messages
    error: _UndocumentedError_schema.optional(),
    warning: _UndocumentedWarning_schema.optional(),

    // [Groq] undocumented statistics message
    x_groq: z.object({
      id: z.string().optional(),
      usage: z.object({
        queue_time: z.number().optional(),
        prompt_tokens: z.number().optional(),
        prompt_time: z.number().optional(),
        completion_tokens: z.number().optional(),
        completion_time: z.number().optional(),
        total_tokens: z.number().optional(),
        total_time: z.number().optional(),
      }).optional(),
      queue_length: z.number().optional(),
    }).optional(),

    // [Perplexity] String array of citations, the first element is the first reference, i.e. '[1]'.
    citations: z.array(z.any()).optional(),
  });

}


//
// Images > Create Image
// https://platform.openai.com/docs/api-reference/images/create
//
export namespace OpenAIWire_API_Images_Generations {

  export type Request = z.infer<typeof Request_schema>;
  const Request_schema = z.object({

    // 32,000 for gpt-image-1, 4,000 for dall-e-3, 1,000 for dall-e-2
    prompt: z.string().max(32000),

    model: z.enum([
      'gpt-image-1',
      'dall-e-3',
      'dall-e-2', // default
    ]).optional(),

    // The number of images to generate. Must be between 1 and 10. For dall-e-3, only n=1 is supported.
    n: z.number().min(1).max(10).nullable().optional(),

    // Image quality
    quality: z.enum([
      'auto',                   // default
      'high', 'medium', 'low',  // gpt-image-1
      'hd', 'standard',         // dall-e-3: hd | standard, dall-e-2: only standard
    ]).optional(),

    // The format in which generated images with dall-e-2 and dall-e-3 are returned.
    //`gpt-image-1` will always return base64-encoded images and does NOT support this parameter.
    response_format: z.enum(['url', 'b64_json']).optional(),

    // size of the generated images
    size: z.enum([
      'auto',       // GI (or default if omitted)
      '256x256',    //          D2
      '512x512',    //          D2
      '1024x1024',  // GI  D3  D2
      // landscape
      '1536x1024',  // GI
      '1792x1024',  //      D3
      // portrait
      '1024x1536',  // GI
      '1024x1792',  //      D3
    ]).optional(),

    // optional unique identifier representing your end-user
    user: z.string().optional(),


    // -- GPT Image 1 Specific Parameters --

    // Allows to set transparency (in that case, format = png or webp)
    background: z.enum(['transparent', 'opaque', 'auto' /* default */]).optional(),

    // Control the content-moderation level for images generated by gpt-image-1.
    moderation: z.enum(['low', 'auto' /* default */]).optional(),

    // The format in which the generated images are returned
    output_format: z.enum(['png' /* default */, 'jpeg', 'webp']).optional(),

    // WEBP/JPEG compression level for gpt-image-1
    output_compression: z.number().min(0).max(100).int().optional(),


    // -- Dall-E 3 Specific Parameters --

    // DALL-E 3 ONLY - style - defaults to vivid
    style: z.enum(['vivid', 'natural']).optional(),

  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    created: z.number(),
    data: z.array(z.object({
      b64_json: z.string().optional(),
      revised_prompt: z.string().optional(),
      url: z.string().url().optional(), // if the response_format is 'url' - DEPRECATED
    })),

    // gpt-image-1 only
    usage: z.object({
      total_tokens: z.number(),
      input_tokens: z.number(), // images + text tokens in the input prompt
      output_tokens: z.number(), // image tokens in the output image
      input_tokens_details: z.object({
        text_tokens: z.number(),
        image_tokens: z.number().optional(), // present if editing
      }).optional(),
    }).optional(),
  });

}

// Images > Edit Image
export namespace OpenAIWire_API_Images_Edits {

  export type Request = z.infer<typeof Request_schema>;

  /**
   * This API method only accepts 'multipart/form-data' requests.
   * The request body must be a FormData object, which we build outside.
   * The spec below represents the first part.
   */
  export const Request_schema = z.object({

    // 32,000 for gpt-image-1, 1,000 for dall-e-2
    prompt: z.string().max(32000),

    // image: file | file[] - REQUIRED - Handled as file uploads in FormData ('image' field)

    // mask: file - OPTIONAL - Handled as file upload in FormData ('mask' field)

    model: z.enum(['gpt-image-1', 'dall-e-2']).optional(),

    // Number of images to generate, between 1 and 10
    n: z.number().min(1).max(10).nullable().optional(),

    // Image quality
    quality: z.enum([
      'auto',                   // default
      'high', 'medium', 'low',  // gpt-image-1
      'standard',               // dall-e-2: only standard
    ]).optional(),

    // response_format: string - OPTIONAL - Defaults to 'url'. Only for DALL-E 2. gpt-image-1 always returns b64_json.
    // OMITTED here as we'll enforce b64_json or handle it based on model if DALL-E 2 edit were supported.

    // size of the generated images
    size: z.enum([
      'auto',       // GI (or default if omitted)
      '256x256',    //          D2
      '512x512',    //          D2
      '1024x1024',  // GI       D2
      // landscape
      '1536x1024',  // GI
      // portrait
      '1024x1536',  // GI
    ]).optional(),

    // optional unique identifier representing your end-user
    user: z.string().optional(),

  });

  // The response schema is identical to OpenAIWire_API_Images_Generations.Response_schema
  export type Response = OpenAIWire_API_Images_Generations.Response;

}


//
// Models > List Models
//
export namespace OpenAIWire_API_Models_List {

  export type Model = z.infer<typeof Model_schema>;
  const Model_schema = z.object({
    id: z.string(),
    object: z.literal('model'),
    created: z.number().optional(),
    // [dialect:OpenAI] 'openai' | 'openai-dev' | 'openai-internal' | 'system'
    owned_by: z.string().optional(),

    // **Extensions**
    // [Openrouter] non-standard - commented because dynamically added by the Openrouter vendor code
    // context_length: z.number().optional(),
  });

  export type Response = z.infer<typeof Response_schema>;
  const Response_schema = z.object({
    object: z.literal('list'),
    data: z.array(Model_schema),
  });

}


//
// Moderations > Create Moderation
//
export namespace OpenAIWire_API_Moderations_Create {

  export type Request = z.infer<typeof Request_schema>;
  const Request_schema = z.object({
    // input: z.union([z.string(), z.array(z.string())]),
    input: z.string(),
    model: z.enum(['text-moderation-stable', 'text-moderation-latest']).optional(),
  });

  const Category_schema = z.enum([
    'sexual',
    'hate',
    'harassment',
    'self-harm',
    'sexual/minors',
    'hate/threatening',
    'violence/graphic',
    'self-harm/intent',
    'self-harm/instructions',
    'harassment/threatening',
    'violence',
  ]);

  const Result_schema = z.object({
    flagged: z.boolean(),
    categories: z.record(Category_schema, z.boolean()),
    category_scores: z.record(Category_schema, z.number()),
  });

  export type Response = z.infer<typeof Response_schema>;
  const Response_schema = z.object({
    id: z.string(),
    model: z.string(),
    results: z.array(Result_schema),
  });

}
