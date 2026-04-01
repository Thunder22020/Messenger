package com.daniel.messenger.security.ratelimit

import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.script.RedisScript
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.stereotype.Component


@Component
class WsRateLimitInterceptor(
    private val redis: RedisTemplate<String, String>,
) : ChannelInterceptor {

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*>? {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message

        if (accessor.command != StompCommand.SEND) return message

        val username = accessor.user?.name ?: return null
        val destination = accessor.destination ?: return message
        val limit = LIMITS[destination] ?: return message

        val key = "ws-rate:$username:${destination.replace('/', ':')}"
        val count = redis.execute(
            RATE_LIMIT_SCRIPT,
            listOf(key),
            limit.windowSeconds.toString()
        )

        return if (count > limit.max) null else message
    }

    companion object {
        private val LIMITS = mapOf(
            "/app/presence.heartbeat" to Limit(max = 1,  windowSeconds = 20),
            "/app/chat.typing"        to Limit(max = 4,  windowSeconds = 3),
            "/app/chat.send"          to Limit(max = 10, windowSeconds = 5),
            "/app/call.signal"        to Limit(max = 20, windowSeconds = 10),
        )

        private val RATE_LIMIT_SCRIPT = RedisScript.of<Long>(
            """
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return count
            """.trimIndent(),
            Long::class.java,
        )
    }
}
