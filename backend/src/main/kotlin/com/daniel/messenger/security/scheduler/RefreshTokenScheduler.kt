package com.daniel.messenger.security.scheduler

import com.daniel.messenger.security.service.RefreshTokenService
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class RefreshTokenScheduler(
    private val refreshTokenService: RefreshTokenService,
) {
    @Scheduled(cron = "0 0 3 * * *")
    fun deleteExpiredTokens() {
        refreshTokenService.deleteExpiredTokens()
    }
}
