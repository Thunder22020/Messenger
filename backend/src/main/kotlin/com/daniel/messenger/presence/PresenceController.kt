package com.daniel.messenger.presence

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

@RestController
@RequestMapping("/api/users")
class PresenceController(
    private val presenceService: PresenceService
) {
    @GetMapping("/online")
    fun online(): Set<String> = presenceService.getOnlineUsernames()

    @GetMapping("/{username}/last-seen")
    fun lastSeen(@PathVariable username: String): LastSeenResponse {
        val lastSeenAt = presenceService.getLastSeen(username)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND)
        return LastSeenResponse(lastSeenAt)
    }
}

data class LastSeenResponse(val lastSeenAt: Instant)
