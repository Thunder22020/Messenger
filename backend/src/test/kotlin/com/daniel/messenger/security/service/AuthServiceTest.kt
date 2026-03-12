package com.daniel.messenger.security.service

import com.daniel.messenger.randomRefreshToken
import com.daniel.messenger.randomString
import com.daniel.messenger.randomUser
import com.daniel.messenger.randomUserRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.any
import org.mockito.BDDMockito.given
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.BadCredentialsException

@ExtendWith(MockitoExtension::class)
class AuthServiceTest {

    @Mock
    private lateinit var authManager: AuthenticationManager

    @Mock
    private lateinit var jwtService: JwtService

    @Mock
    private lateinit var refreshTokenService: RefreshTokenService

    @InjectMocks
    private lateinit var authService: AuthService

    private val user = randomUser()
    private val request = randomUserRequest(username = user.username)
    private val refreshToken = randomRefreshToken(user = user)
    private val accessToken = randomString()

    @Test
    fun `verifyAndGetTokens - should return access and refresh tokens on valid credentials`() {
        given(jwtService.generateToken(request.username)).willReturn(accessToken)
        given(refreshTokenService.createRefreshToken(request.username)).willReturn(refreshToken)

        val result = authService.verifyAndGetTokens(request)

        assertThat(result.accessToken).isEqualTo(accessToken)
        assertThat(result.refreshToken).isEqualTo(refreshToken.token)
    }

    @Test
    fun `verifyAndGetTokens - should propagate exception when authentication fails`() {
        given(authManager.authenticate(any())).willThrow(BadCredentialsException("Bad credentials"))

        assertThrows<BadCredentialsException> { authService.verifyAndGetTokens(request) }
    }
}
