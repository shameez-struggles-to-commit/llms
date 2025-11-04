/**
 * Server-Sent Events (SSE) streaming utilities for chat completions
 */

/**
 * Parse and process SSE stream from fetch response
 * @param {Response} response - Fetch response object
 * @param {Function} onChunk - Callback for each chunk: (chunk) => void
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<void>}
 */
export async function processSSEStream(response, onChunk, signal) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (true) {
            const { done, value } = await reader.read()
            
            // Check for abort
            if (signal?.aborted) {
                reader.cancel()
                break
            }

            if (done) break

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true })

            // Process complete SSE messages
            const lines = buffer.split('\n')
            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || ''

            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                
                // SSE format: "data: {...}"
                if (trimmed.startsWith('data: ')) {
                    const data = trimmed.substring(6)
                    
                    // Check for stream end marker
                    if (data === '[DONE]') {
                        return
                    }

                    try {
                        const chunk = JSON.parse(data)
                        
                        // Check for error
                        if (chunk.error) {
                            throw new Error(chunk.error.message || 'Stream error')
                        }

                        // Call the chunk handler
                        onChunk(chunk)
                    } catch (e) {
                        if (e instanceof SyntaxError) {
                            console.warn('Failed to parse SSE chunk:', data, e)
                        } else {
                            throw e
                        }
                    }
                }
            }
        }
    } finally {
        reader.releaseLock()
    }
}

/**
 * Accumulate streaming chunks into a complete response
 * @param {Array} chunks - Array of SSE chunks
 * @returns {Object} Complete response object
 */
export function accumulateChunks(chunks) {
    if (chunks.length === 0) {
        return null
    }

    // Use first chunk as template
    const firstChunk = chunks[0]
    const result = {
        id: firstChunk.id,
        object: 'chat.completion',
        created: firstChunk.created,
        model: firstChunk.model,
        choices: [],
    }

    // Accumulate content from all chunks
    const choiceMap = new Map()

    for (const chunk of chunks) {
        if (!chunk.choices) continue

        for (const choice of chunk.choices) {
            const index = choice.index || 0
            
            if (!choiceMap.has(index)) {
                choiceMap.set(index, {
                    index,
                    message: {
                        role: 'assistant',
                        content: '',
                    },
                    finish_reason: null,
                })
            }

            const accumulated = choiceMap.get(index)

            // Accumulate content from delta
            if (choice.delta) {
                if (choice.delta.role) {
                    accumulated.message.role = choice.delta.role
                }
                if (choice.delta.content) {
                    accumulated.message.content += choice.delta.content
                }
            }

            // Update finish reason
            if (choice.finish_reason) {
                accumulated.finish_reason = choice.finish_reason
            }
        }
    }

    result.choices = Array.from(choiceMap.values())

    // Add usage if available (usually in last chunk)
    const lastChunk = chunks[chunks.length - 1]
    if (lastChunk.usage) {
        result.usage = lastChunk.usage
    }

    return result
}
