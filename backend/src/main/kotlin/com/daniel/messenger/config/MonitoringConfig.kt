package com.daniel.messenger.config

import com.daniel.messenger.presence.PresenceService
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import jakarta.annotation.PostConstruct
import org.springframework.context.annotation.Configuration

@Configuration
class MonitoringConfig(
    private val presenceService: PresenceService,
    private val meterRegistry: MeterRegistry,
) {
    @PostConstruct
    fun registerMetrics() {
        Gauge.builder("messenger.users.online", presenceService) { ps ->
            ps.getOnlineUsernames().size.toDouble()
        }
        .description("Number of currently online users")
        .register(meterRegistry)
    }
}
