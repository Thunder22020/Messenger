package com.daniel.messenger.presence

import jakarta.annotation.PostConstruct
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.script.RedisScript
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import java.time.Duration

@Service
class PresenceService(
    private val redis: RedisTemplate<String, String>,
    private val messaging: SimpMessagingTemplate,
) {
    @PostConstruct
    fun cleanupOnStartup() {
        redis.delete(ONLINE_KEY)
        val staleConnKeys = redis.keys("$CONNECTIONS_KEY:*")
        if (!staleConnKeys.isNullOrEmpty()) redis.delete(staleConnKeys)
    }

    fun userConnected(userId: Long) {
        redis.opsForValue().increment(connKey(userId))
    }

    fun userDisconnected(userId: Long, username: String) {
        val cnt = redis.opsForValue().decrement(connKey(userId)) ?: 0L
        if (cnt <= 0L) {
            redis.delete(connKey(userId))
            redis.delete(heartbeatKey(username))
            val removed = redis.opsForSet().remove(ONLINE_KEY, username) ?: 0L
            if (removed > 0L) {
                messaging.convertAndSend("/topic/presence", PresenceEvent(username, false))
            }
        }
    }

    fun heartbeat(username: String) {
        val isNew = (redis.opsForSet().add(ONLINE_KEY, username) ?: 0L) > 0L
        redis.opsForValue().set(heartbeatKey(username), "1", Duration.ofSeconds(HEARTBEAT_TTL_SECONDS))
        if (isNew) {
            messaging.convertAndSend("/topic/presence", PresenceEvent(username, true))
        }
    }

    fun evictStaleUsers() {
        val evicted = redis.execute(
            EVICT_SCRIPT,
            listOf(ONLINE_KEY),
            HEARTBEAT_KEY,
        )?.filterIsInstance<String>() ?: return

        for (username in evicted) {
            messaging.convertAndSend("/topic/presence", PresenceEvent(username, false))
        }
    }

    fun getOnlineUsernames(): Set<String> =
        redis.opsForSet().members(ONLINE_KEY).orEmpty()

    private fun connKey(userId: Long) = "$CONNECTIONS_KEY:$userId"
    private fun heartbeatKey(username: String) = "$HEARTBEAT_KEY:$username"

    companion object {
        private const val ONLINE_KEY = "presence:online"
        private const val CONNECTIONS_KEY = "presence:connections"
        private const val HEARTBEAT_KEY = "presence:heartbeat"
        const val HEARTBEAT_TTL_SECONDS = 30L

        private val EVICT_SCRIPT: RedisScript<List<String>> = RedisScript.of(
            """
            local online  = redis.call('SMEMBERS', KEYS[1])
            local evicted = {}
            for _, username in ipairs(online) do
                if redis.call('EXISTS', ARGV[1] .. ':' .. username) == 0 then
                    redis.call('SREM', KEYS[1], username)
                    table.insert(evicted, username)
                end
            end
            return evicted
            """.trimIndent(),
            List::class.java as Class<List<String>>,
        )
    }
}
