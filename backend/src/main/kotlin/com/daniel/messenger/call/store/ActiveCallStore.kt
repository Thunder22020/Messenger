package com.daniel.messenger.call.store

import com.daniel.messenger.call.dto.ActiveCall
import com.daniel.messenger.call.dto.CallStatus
import tools.jackson.core.JacksonException
import tools.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

@Component
class ActiveCallStore(
    private val redis: RedisTemplate<String, String>,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(ActiveCallStore::class.java)

    fun save(call: ActiveCall) {
        persist(call, Duration.ofSeconds(RINGING_TTL_SECONDS))
    }

    fun find(callId: String): ActiveCall? {
        val json = redis.opsForValue().get(callKey(callId)) ?: return null
        return deserialize(json)
    }

    fun findByUserId(userId: Long): ActiveCall? {
        val callId = redis.opsForValue().get(userKey(userId)) ?: return null
        return find(callId)
    }

    fun update(call: ActiveCall) {
        persist(call, Duration.ofSeconds(ACTIVE_TTL_SECONDS))
    }

    fun remove(call: ActiveCall) {
        redis.delete(callKey(call.callId))
        redis.delete(userKey(call.callerId))
        redis.delete(userKey(call.receiverId))
    }

    private fun persist(call: ActiveCall, ttl: Duration) {
        val json = objectMapper.writeValueAsString(call)
        redis.opsForValue().set(callKey(call.callId), json, ttl)
        redis.opsForValue().set(userKey(call.callerId), call.callId, ttl)
        redis.opsForValue().set(userKey(call.receiverId), call.callId, ttl)
    }

    private fun deserialize(json: String): ActiveCall? =
        try {
            objectMapper.readValue(json, ActiveCall::class.java)
        } catch (e: JacksonException) {
            log.warn("Failed to deserialize ActiveCall from Redis: {}", e.message)
            null
        }

    companion object {
        private const val RINGING_TTL_SECONDS = 60L
        private const val ACTIVE_TTL_SECONDS = 3600L
        private fun callKey(callId: String) = "call:$callId"
        private fun userKey(userId: Long) = "call:user:$userId"
    }
}
