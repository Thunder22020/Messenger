package com.daniel.messenger.security.ratelimit

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import java.time.Duration

@Component
class RateLimitInterceptor(
    private val redis: RedisTemplate<String, String>
) : HandlerInterceptor {

    override fun preHandle(
        req: HttpServletRequest,
        res: HttpServletResponse,
        handler: Any)
    : Boolean {
        val limit = limits[req.requestURI] ?: return true
        val ip = extractIp(req)
        val key = "rate:${req.requestURI.replace("/", ":")}:$ip"
        val count = redis.opsForValue().increment(key) ?: 1L
        if (count == 1L) redis.expire(key, Duration.ofSeconds(limit.windowSeconds))

        if (count > limit.max) {
            res.status = HttpStatus.TOO_MANY_REQUESTS.value()
            res.setHeader("Retry-After", limit.windowSeconds.toString())
            res.contentType = "application/json"
            res.writer.write("""{"error":"Too many requests"}""")
            return false
        }
        return true
    }

    private fun extractIp(req: HttpServletRequest): String? {
        return req.getHeader("X-Forwarded-For")
            ?.split(",")
            ?.firstOrNull()
            ?.trim()
            ?: req.remoteAddr
    }

    companion object {
        private val limits = mapOf(
            "/api/auth/login" to Limit(10, 900),
            "/api/auth/register" to Limit(5, 3600)
        )
    }

    private data class Limit(val max: Int, val windowSeconds: Long)
}
