import Fastify from 'fastify'
import Redis from 'ioredis'

const app = Fastify({ logger: true })
const redis = new Redis(process.env.REDIS_URL)

app.post('/webhook/ai-calling/bot', async (req, reply) => {
  const started = Date.now()

  const { call_id, stage, client_transcript, context_id } = req.body || {}

  if (!call_id || !context_id) {
    return reply.code(400).send({ error: 'invalid payload' })
  }

  const base = `call:${call_id}`

  if (stage) {
    await redis.set(`${base}:stage`, stage, 'EX', 86400)
  }

  if (client_transcript) {
    await redis.lpush(`${base}:history`, client_transcript)
    await redis.ltrim(`${base}:history`, 0, 2)
    await redis.expire(`${base}:history`, 86400)
  }

  const prompt = await redis.get(`prompt:system:${context_id}`)

  return {
    reply_text: prompt
      ? 'Принял, секунду…'
      : 'Здравствуйте! Чем могу помочь?',
    end_call: false,
    meta: { latency_ms: Date.now() - started }
  }
})

app.get('/health', async () => ({ ok: true }))

app.post('/admin/prompt', async (req, reply) => {
  const { id, text } = req.body || {}

  if (!id || !text) {
    return reply.code(400).send({ error: 'id and text required' })
  }

  await redis.set(`prompt:system:${id}`, text)
  return { ok: true }
})

app.listen({
  port: process.env.PORT || 3000,
  host: '0.0.0.0'
})
