package com.daniel.messenger.push.controller

import com.daniel.messenger.push.dto.PushSubscribeRequest
import com.daniel.messenger.push.service.PushNotificationService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.security.Principal

@RestController
@RequestMapping("/api/push")
class PushController(private val pushNotificationService: PushNotificationService) {

    @PostMapping("/subscribe")
    fun subscribe(@RequestBody req: PushSubscribeRequest, principal: Principal): ResponseEntity<Void> {
        pushNotificationService.saveSubscription(
            username = principal.name,
            endpoint = req.endpoint,
            p256dh = req.p256dh,
            auth = req.auth,
        )
        return ResponseEntity.ok().build()
    }

    @DeleteMapping("/subscribe")
    fun unsubscribe(@RequestBody req: PushSubscribeRequest, principal: Principal): ResponseEntity<Void> {
        pushNotificationService.deleteSubscription(req.endpoint)
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/public-key")
    fun getPublicKey(): Map<String, String> =
        mapOf("publicKey" to pushNotificationService.vapidPublicKey)
}
