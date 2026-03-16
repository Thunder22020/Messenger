package com.daniel.messenger.presence

import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Service

@Service
class PresenceService(
    private val redis: RedisTemplate<String, String>
) {
    fun userConnected(userId: Long) {
        val cnt = redis.opsForValue().increment(connKey(userId)) ?: 1L
        if (cnt == 1L) redis.opsForSet().add(ONLINE_KEY, userId.toString())
    }

    fun userDisconnected(userId: Long) {
        val cnt = redis.opsForValue().decrement(connKey(userId)) ?: 0L
        if (cnt <= 0L) {
            redis.delete(connKey(userId))
            redis.opsForSet().remove(ONLINE_KEY, userId.toString())
        }
    }

    fun getOnlineUserIds(): Set<Long> =
        redis.opsForSet().members(ONLINE_KEY)
            .orEmpty()
            .mapNotNull { it.toLongOrNull() }
            .toSet()

    private fun connKey(userId: Long) = "$CONNECTIONS_KEY:$userId"

    companion object {
        private const val ONLINE_KEY = "presence:online"
        private const val CONNECTIONS_KEY = "presence:connections"
    }
}
