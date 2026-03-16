package com.daniel.messenger.presence

import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class PresenceScheduler(
    private val presenceService: PresenceService,
) {
    @Scheduled(fixedDelay = 30_000)
    fun evictStaleUsers() {
        presenceService.evictStaleUsers()
    }
}
