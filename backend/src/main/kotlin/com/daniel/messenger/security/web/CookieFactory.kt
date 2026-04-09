package com.daniel.messenger.security.web

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import java.time.Duration

@Component
class CookieFactory(
    @Value("\${app.jwt.refresh-expiration}")
    private val expirationDays: Int,
    // Set to false in local HTTP dev so Safari sends the cookie over http://localhost
    @Value("\${app.cookie.secure:true}")
    private val secureCookie: Boolean,
) {
    fun createRefreshTokenCookie(token: String): ResponseCookie =
        ResponseCookie.from(REFRESH_TOKEN_COOKIE, token)
            .httpOnly(true)
            .secure(secureCookie)
            .path("/")
            .maxAge(Duration.ofDays(expirationDays.toLong()))
            .sameSite(if (secureCookie) "None" else "Lax")
            .build()

    fun getEmptyRefreshCookie(): ResponseCookie =
        ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
            .httpOnly(true)
            .secure(secureCookie)
            .path("/")
            .maxAge(Duration.ZERO)
            .sameSite(if (secureCookie) "None" else "Lax")
            .build()

    companion object {
        private const val REFRESH_TOKEN_COOKIE = "refreshToken"
    }
}
