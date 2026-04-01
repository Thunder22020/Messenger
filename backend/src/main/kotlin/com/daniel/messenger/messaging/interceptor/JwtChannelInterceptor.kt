package com.daniel.messenger.messaging.interceptor

import com.daniel.messenger.security.service.JwtService
import com.daniel.messenger.security.util.JwtConstants
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.stereotype.Component
import java.util.Date

@Component
class JwtChannelInterceptor(
    private val jwtService: JwtService,
    private val userDetailsService: UserDetailsService,
) : ChannelInterceptor {
    override fun preSend(
        message: Message<*>,
        channel: MessageChannel
    ): Message<*>? {
        val accessor = MessageHeaderAccessor.getAccessor(
            message,
            StompHeaderAccessor::class.java
        ) ?: return message

        return when (accessor.command) {
            StompCommand.CONNECT -> {
                val authentication = authenticate(accessor) ?: return null
                accessor.user = authentication
                message
            }
            StompCommand.SEND, StompCommand.SUBSCRIBE, StompCommand.UNSUBSCRIBE -> {
                if (accessor.user == null) null else message
            }
            else -> message
        }
    }

    private fun authenticate(accessor: StompHeaderAccessor): UsernamePasswordAuthenticationToken? {
        val token = extractTokenFromHeader(accessor) ?: return null

        val claims = jwtService.parseToken(token) ?: return null
        val username = claims.subject ?: return null
        if (claims.expiration.before(Date())) return null

        val userDetails = runCatching {
            userDetailsService.loadUserByUsername(username)
        }.getOrNull() ?: return null

        return UsernamePasswordAuthenticationToken(
            userDetails,
            null,
            userDetails.authorities
        )
    }

    private fun extractTokenFromHeader(accessor: StompHeaderAccessor): String? {
        val authHeader = accessor.getFirstNativeHeader(JwtConstants.AUTH_HEADER)
            ?: return null

        if (!authHeader.startsWith(JwtConstants.BEARER_PREFIX)) return null

        return authHeader.removePrefix(JwtConstants.BEARER_PREFIX)
    }
}
