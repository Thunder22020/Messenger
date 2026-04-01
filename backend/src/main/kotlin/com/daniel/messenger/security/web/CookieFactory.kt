package com.daniel.messenger.security.web

import jakarta.servlet.http.Cookie
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class CookieFactory(
    @Value("\${app.jwt.refresh-expiration}")
    private val expirationDays: Int
) {
    fun createRefreshTokenCookie(token: String) =
        Cookie(REFRESH_TOKEN_COOKIE, token).apply {
            isHttpOnly = true
            secure = true
            path = "/"
            maxAge = expirationDays * 24 * 60 * 60
        }

    fun getEmptyRefreshCookie() =
        Cookie(REFRESH_TOKEN_COOKIE, "").apply {
            isHttpOnly = true
            secure = true
            path = "/"
            maxAge = 0
        }

    companion object {
        private const val REFRESH_TOKEN_COOKIE = "refreshToken"
    }
}