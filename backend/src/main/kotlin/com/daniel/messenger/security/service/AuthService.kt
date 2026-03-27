package com.daniel.messenger.security.service

import com.daniel.messenger.security.dto.SecurityTokens
import com.daniel.messenger.user.dto.UserRequest
import com.daniel.messenger.user.exception.UserNotFoundException
import com.daniel.messenger.user.repository.UserRepository
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val authManager: AuthenticationManager,
    private val jwtService: JwtService,
    private val refreshTokenService: RefreshTokenService,
    private val userRepository: UserRepository,
) {
    fun verifyAndGetTokens(user: UserRequest): SecurityTokens {
        if (userRepository.findByUsername(user.username) == null) {
            throw UserNotFoundException("User not found")
        }

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