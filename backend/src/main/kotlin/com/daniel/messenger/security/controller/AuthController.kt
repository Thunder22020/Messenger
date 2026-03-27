package com.daniel.messenger.security.controller

import com.daniel.messenger.security.dto.AccessTokenResponse
import com.daniel.messenger.security.service.AuthService
import com.daniel.messenger.security.service.RefreshTokenService
import com.daniel.messenger.security.web.CookieFactory
import com.daniel.messenger.user.dto.RegisterRequest
import com.daniel.messenger.user.dto.UserRequest
import com.daniel.messenger.user.service.UserService
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val userService: UserService,
    private val authService: AuthService,
    private val refreshTokenService: RefreshTokenService,
    private val cookieFactory: CookieFactory
) {
    @PostMapping("/register")
    fun register(@Valid @RequestBody user: RegisterRequest) = userService.save(user)

    @PostMapping("/login")
    fun login(
        @RequestBody user: UserRequest,
        response: HttpServletResponse
    ): AccessTokenResponse {
        val tokens = authService.verifyAndGetTokens(user)

        val cookie = cookieFactory.createRefreshTokenCookie(tokens.refreshToken)
        response.addCookie(cookie)

        return AccessTokenResponse(tokens.accessToken)
    }

    @PostMapping("/refresh")
    fun refresh(
        @CookieValue("refreshToken")
        refreshToken: String
    ): AccessTokenResponse {
        val accessToken = refreshTokenService.rotateAccessToken(refreshToken)
        return AccessTokenResponse(accessToken.accessToken)
    }

    @PostMapping("/logout")
    fun logout(
        @CookieValue("refreshToken", required=false)
        refreshToken: String?,
        response: HttpServletResponse
    ) {
        refreshToken?.let {
            refreshTokenService.deleteByToken(it)
        }
        val cookie = cookieFactory.getEmptyRefreshCookie()
        response.addCookie(cookie)
    }

    @GetMapping("/testAuth")
    fun testAuth() = "Auth successful"
}