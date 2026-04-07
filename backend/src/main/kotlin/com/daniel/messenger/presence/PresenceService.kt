package com.daniel.messenger.presence

import com.daniel.messenger.user.repository.UserRepository
import jakarta.annotation.PostConstruct
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.script.RedisScript
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

@Service
class PresenceService(
    private val redis: RedisTemplate<String, String>,
    private val simpMessagingTemplate: SimpMessagingTemplate,
    private val userRepository: UserRepository,
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

    @Transactional
    fun userDisconnected(userId: Long, username: String) {
        val cnt = redis.opsForValue().decrement(connectionKey(userId)) ?: 0L
        if (!isAllConnectionsClosed(cnt)) return

        redis.delete(heartbeatKey(username))
        redis.delete(connectionKey(userId))

        val numOfRemoved = redis.opsForSet().remove(ONLINE_KEY, username)
        if (numOfRemoved != null && numOfRemoved > 0) {
            val now = Instant.now()
            userRepository.updateLastSeenAt(username, now)
            sendOfflinePresenceEvent(username, now)
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

    @Transactional
    fun evictStaleUsers() {
        val evicted = redis.execute(
            EVICT_SCRIPT,
            listOf(ONLINE_KEY),
            HEARTBEAT_KEY,
        )?.filterIsInstance<String>() ?: return
        val now = Instant.now()
        evicted.forEach {
            userRepository.updateLastSeenAt(it, now)
            sendOfflinePresenceEvent(it, now)
        }
    }

    fun getOnlineUsernames(): Set<String> =
        redis.opsForSet().members(ONLINE_KEY).orEmpty()

    private fun isAllConnectionsClosed(cnt: Long) = cnt <= 0L

    fun getLastSeen(username: String): Instant? =
        userRepository.findByUsername(username)?.lastSeenAt

    private fun sendOnlinePresenceEvent(username: String) {
        simpMessagingTemplate.convertAndSend(
            PRESENCE_TOPIC,
            PresenceEvent(username, true)
        )
    }

    private fun sendOfflinePresenceEvent(username: String, lastSeenAt: Instant) {
        simpMessagingTemplate.convertAndSend(
            PRESENCE_TOPIC,
            PresenceEvent(username, false, lastSeenAt)
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
