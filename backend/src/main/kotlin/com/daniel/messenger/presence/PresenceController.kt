package com.daniel.messenger.presence

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users")
class PresenceController(
    private val presenceService: PresenceService
) {
    @GetMapping("/online")
    fun online(): Set<Long> = presenceService.getOnlineUserIds()
}
