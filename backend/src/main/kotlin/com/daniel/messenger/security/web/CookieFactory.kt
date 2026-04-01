package com.daniel.messenger.security.web

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import java.time.Duration

@Component
class CookieFactory(
    @Value("\${app.jwt.refresh-expiration}")
    private val expirationDays: Int
) {
    fun createRefreshTokenCookie(token: String): ResponseCookie =
        ResponseCookie.from(REFRESH_TOKEN_COOKIE, token)
            .httpOnly(true)
            .secure(true)
            .path("/")
            .maxAge(Duration.ofDays(expirationDays.toLong()))
            .sameSite("Lax")
            .build()

    fun getEmptyRefreshCookie(): ResponseCookie =
        ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
            .httpOnly(true)
            .secure(true)
            .path("/")
            .maxAge(Duration.ZERO)
            .sameSite("Lax")
            .build()

    companion object {
        private const val REFRESH_TOKEN_COOKIE = "refreshToken"
    }
}
