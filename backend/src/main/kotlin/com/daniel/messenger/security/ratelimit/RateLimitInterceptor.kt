package com.daniel.messenger.security.ratelimit

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.data.redis.core.RedisTemplate
import org.springframework.data.redis.core.script.RedisScript
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
        val limitWindowAsString = limit.windowSeconds.toString()
        val ip = extractIp(req)
        val key = "rate:${req.requestURI.replace("/", ":")}:$ip"
        val count = redis.execute(
            RATE_LIMIT_SCRIPT,
            listOf(key),
            limitWindowAsString,
        )
        if (count > limit.max) {
            setResponseAsNotFound(res, limitWindowAsString)
            return false
        }
        return true
    }

    private fun extractIp(req: HttpServletRequest): String {
        return req.getHeader("X-Forwarded-For")
            ?.split(",")
            ?.firstOrNull()
            ?.trim()
            ?: req.remoteAddr
    }

    private fun setResponseAsNotFound(res: HttpServletResponse, retryAfter: String) {
        res.status = HttpStatus.TOO_MANY_REQUESTS.value()
        res.setHeader("Retry-After", retryAfter)
        res.contentType = "application/json"
        res.writer.write("""{"error":"Too many requests"}""")
    }

    companion object {
        private val limits = mapOf(
            "/api/auth/login" to Limit(10, 900),
            "/api/auth/register" to Limit(5, 3600)
        )

        private val RATE_LIMIT_SCRIPT = RedisScript.of<Long>(
            """
            local count = redis.call('INCR', KEYS[1])
            if count == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return count
            """.trimIndent(), Long::class.java)
    }

    private data class Limit(val max: Int, val windowSeconds: Long)
}
