package com.daniel.messenger.messaging.interceptor

import com.daniel.messenger.security.service.JwtService
import com.daniel.messenger.security.userdetails.UserPrincipal
import com.daniel.messenger.security.util.JwtConstants
import com.daniel.messenger.user.service.UserService
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.stereotype.Component

@Component
class JwtChannelInterceptor(
    private val jwtService: JwtService,
    private val userService: UserService
) : ChannelInterceptor {
    override fun preSend(
        message: Message<*>,
        channel: MessageChannel
    ): Message<*>? {
        val accessor = MessageHeaderAccessor.getAccessor(
            message,
            StompHeaderAccessor::class.java
        ) ?: return message

        if (accessor.command != StompCommand.CONNECT) {
            return message
        }

        val authentication = authenticate(accessor)
            ?: return null

        accessor.user = authentication
        return message
    }

    private fun authenticate(accessor: StompHeaderAccessor) : UsernamePasswordAuthenticationToken? {
        val token = extractTokenFromHeader(accessor) ?: return null

        val username = jwtService.extractUsername(token)
        val user = userService.runCatching {
            findByUsernameOrThrow(username)
        }.getOrNull() ?: return null

        if (!jwtService.validateToken(token, user.username)) {
            return null
        }
        val userPrincipal = UserPrincipal(user)
        return UsernamePasswordAuthenticationToken(
            userPrincipal,
            null,
            emptyList()
        )
    }

    private fun extractTokenFromHeader(accessor: StompHeaderAccessor): String? {
        val authHeader = accessor.getFirstNativeHeader(JwtConstants.AUTH_HEADER)
            ?: return null

        if (!authHeader.startsWith(JwtConstants.BEARER_PREFIX)) return null

        return authHeader.removePrefix(JwtConstants.BEARER_PREFIX)
    }
}
