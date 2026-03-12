package com.daniel.messenger.messaging.controller

import com.daniel.messenger.messaging.dto.EditMessageRequest
import com.daniel.messenger.messaging.dto.MessageResponse
import com.daniel.messenger.messaging.dto.PagedMessageResponse
import com.daniel.messenger.messaging.service.MessageService
import com.daniel.messenger.security.userdetails.UserPrincipal
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/messages")
class MessageController(
    private val messageService: MessageService,
) {
    @GetMapping("/{chatId}")
    fun getMessages(
        @PathVariable chatId: Long,
        @RequestParam before: Long?,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): PagedMessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.getMessages(chatId, userId, before)
    }

    @PatchMapping("/{messageId}")
    fun editMessage(
        @PathVariable messageId: Long,
        @RequestBody request: EditMessageRequest,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): MessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.editMessage(messageId, request, userId)
    }

    @DeleteMapping("/{messageId}")
    fun deleteMessage(
        @PathVariable messageId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): MessageResponse {
        val userId = requireNotNull(userPrincipal.user.id)
        return messageService.deleteMessage(messageId, userId)
    }
}
