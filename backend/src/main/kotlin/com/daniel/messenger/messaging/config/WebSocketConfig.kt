package com.daniel.messenger.messaging.config

import com.daniel.messenger.messaging.interceptor.JwtChannelInterceptor
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.messaging.simp.config.ChannelRegistration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration

@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig(
    private val jwtChannelInterceptor: JwtChannelInterceptor,
    @Value("\${app.cors.allowed-origins}")
    private val allowedOrigins: String,
) : WebSocketMessageBrokerConfigurer {

    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        registry.addEndpoint("/ws")
            .setAllowedOrigins(allowedOrigins)
    }

    override fun configureMessageBroker(registry: MessageBrokerRegistry) {
        registry.enableSimpleBroker("/topic", "/queue")
            .setHeartbeatValue(longArrayOf(HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS))
            .setTaskScheduler(getScheduler())
        registry.setApplicationDestinationPrefixes("/app")
    }

    override fun configureWebSocketTransport(registry: WebSocketTransportRegistration) {
        registry
            .setSendBufferSizeLimit(SEND_BUFFER_SIZE_LIMIT)
            .setSendTimeLimit(SEND_TIME_LIMIT)
            .setMessageSizeLimit(MESSAGE_SIZE_LIMIT)
    }

    private fun getScheduler() = ThreadPoolTaskScheduler().apply {
        poolSize = 1
        setThreadNamePrefix("ws-heartbeat-")
        initialize()
    }

    override fun configureClientInboundChannel(registration: ChannelRegistration) {
        registration.interceptors(jwtChannelInterceptor)
    }

    companion object {
        private const val HEARTBEAT_INTERVAL_MS = 10000L
        private const val SEND_BUFFER_SIZE_LIMIT = 512 * 1024
        private const val SEND_TIME_LIMIT = 20_000
        private const val MESSAGE_SIZE_LIMIT = 128 * 1024
    }
}
