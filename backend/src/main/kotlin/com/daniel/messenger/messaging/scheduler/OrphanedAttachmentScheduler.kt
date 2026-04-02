package com.daniel.messenger.messaging.scheduler

import com.daniel.messenger.messaging.service.AttachmentService
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.temporal.ChronoUnit

@Component
class OrphanedAttachmentScheduler(
    private val attachmentService: AttachmentService,
) {
    @Scheduled(fixedDelay = 3_600_000)
    fun deleteOrphanedAttachments() {
        val cutoff = Instant.now().minus(1, ChronoUnit.HOURS)
        attachmentService.deleteOrphaned(cutoff)
    }
}
