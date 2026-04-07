package com.daniel.messenger.presence

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class PresenceScheduler(
    private val presenceService: PresenceService,
) {
    private val auditLog = LoggerFactory.getLogger("online-audit")

    @Scheduled(fixedDelay = 30_000)
    fun evictStaleUsers() {
        presenceService.evictStaleUsers()
    }

    @Scheduled(cron = "0 0 * * * *")
    fun logOnlineUsers() {
        val users = presenceService.getOnlineUsernames()
        auditLog.info("count={} users=[{}]", users.size, users.sorted().joinToString(", "))
    }
}
