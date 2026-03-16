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
    private val simpMessagingTemplate: SimpMessagingTemplate
) {
    @PostConstruct
    fun cleanupOnStartup() {
        redis.delete(ONLINE_KEY)
        val staleConnKeys = redis.keys("$CONNECTIONS_KEY:*")
        if (!staleConnKeys.isNullOrEmpty()) redis.delete(staleConnKeys)
    }

    fun userConnected(userId: Long) {
        redis.opsForValue().increment(connectionKey(userId))
    }

    fun userDisconnected(userId: Long, username: String) {
        val cnt = redis.opsForValue().decrement(connectionKey(userId)) ?: 0L
        if (!isAllConnectionsClosed(cnt)) return

        redis.delete(heartbeatKey(username))
        redis.delete(connectionKey(userId))

        val numOfRemoved = redis.opsForSet().remove(ONLINE_KEY, username)
        if (numOfRemoved > 0) {
            sendOfflinePresenceEvent(username)
        }
    }

    fun heartbeat(username: String) {
        val isNew = (redis.opsForSet().add(ONLINE_KEY, username) ?: 0L) > 0L
        redis.opsForValue().set(
            heartbeatKey(username),
            STUB,
            Duration.ofSeconds(HEARTBEAT_TTL_SECONDS)
        )
        if (isNew) {
            sendOnlinePresenceEvent(username)
        }
    }

    fun evictStaleUsers() {
        val evicted = redis.execute(
            EVICT_SCRIPT,
            listOf(ONLINE_KEY),
            HEARTBEAT_KEY,
        )?.filterIsInstance<String>() ?: return
        evicted.forEach { sendOfflinePresenceEvent(it) }
    }

    fun getOnlineUsernames(): Set<String> =
        redis.opsForSet().members(ONLINE_KEY).orEmpty()

    private fun isAllConnectionsClosed(cnt: Long) = cnt <= 0L

    private fun sendOnlinePresenceEvent(username: String) {
        sendPresenceEvent(username, true)
    }

    private fun sendOfflinePresenceEvent(username: String) {
        sendPresenceEvent(username, false)
    }

    private fun sendPresenceEvent(username: String, online: Boolean) {
        simpMessagingTemplate.convertAndSend(
            PRESENCE_TOPIC,
            PresenceEvent(username, online)
        )
    }

    private fun connectionKey(userId: Long) = "$CONNECTIONS_KEY:$userId"
    private fun heartbeatKey(username: String) = "$HEARTBEAT_KEY:$username"

    companion object {
        private const val ONLINE_KEY = "presence:online"
        private const val HEARTBEAT_KEY = "presence:heartbeat"
        private const val CONNECTIONS_KEY = "presence:connections"
        private const val PRESENCE_TOPIC = "/topic/presence"
        private const val STUB = "1"
        private const val HEARTBEAT_TTL_SECONDS = 30L

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
