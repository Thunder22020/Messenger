package com.daniel.messenger.security.service

import com.daniel.messenger.security.dto.SecurityTokens
import com.daniel.messenger.user.dto.UserRequest
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val authManager: AuthenticationManager,
    private val jwtService: JwtService,
    private val refreshTokenService: RefreshTokenService,
) {
    fun verifyAndGetTokens(user: UserRequest): SecurityTokens {
        authManager.authenticate(
            UsernamePasswordAuthenticationToken(
                user.username,
                user.password
            )
        )

        val accessToken = jwtService.generateToken(user.username)
        val refreshToken = refreshTokenService.createRefreshToken(user.username)

        return SecurityTokens(
            accessToken,
            refreshToken.token
        )
    }
}