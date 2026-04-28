package com.daniel.messenger.messaging.controller

import com.daniel.messenger.messaging.dto.request.AddParticipantRequest
import com.daniel.messenger.messaging.dto.response.ChatParticipantResponse
import com.daniel.messenger.messaging.dto.request.CreateGroupChatRequest
import com.daniel.messenger.messaging.dto.response.MyChatResponse
import com.daniel.messenger.messaging.dto.response.OpenChatResponse
import com.daniel.messenger.messaging.service.ChatParticipantService
import com.daniel.messenger.messaging.service.ChatService
import com.daniel.messenger.security.userdetails.UserPrincipal
import jakarta.validation.Valid
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import com.daniel.messenger.storage.S3StorageService
import java.util.UUID

@RestController
@RequestMapping("/chat")
class ChatController(
    private val chatService: ChatService,
    private val chatParticipantService: ChatParticipantService,
    private val s3StorageService: S3StorageService,
) {
    @PostMapping("/private/{receiverId}")
    fun openPrivateChat(
        @PathVariable receiverId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): OpenChatResponse {
        val senderId = requireNotNull(userPrincipal.user.id)
        return chatService.openPrivateChat(senderId, receiverId)
    }

    @PostMapping("/{chatId}/read")
    fun markAsRead(
        @PathVariable chatId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ) {
        val userId = requireNotNull(userPrincipal.user.id)
        chatParticipantService.markAsRead(chatId, userId)
    }

    @GetMapping("/my")
    fun myChats(
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): List<MyChatResponse> {
        val userId = requireNotNull(userPrincipal.user.id)
        return chatService.getUserChats(userId)
    }

    @PostMapping("/group")
    fun createGroupChat(
        @Valid @RequestBody request: CreateGroupChatRequest,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ): OpenChatResponse {
        val creatorId = requireNotNull(userPrincipal.user.id)
        return chatService.createGroupChat(
            creatorId,
            request.title,
            request.participantIds
        )
    }

    @GetMapping("/{chatId}/participants")
    fun getParticipants(
        @PathVariable chatId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ): List<ChatParticipantResponse> {
        val userId = requireNotNull(userPrincipal.user.id)
        return chatService.getChatParticipants(chatId, userId)
    }

    @PostMapping("/{chatId}/participants")
    fun addParticipants(
        @PathVariable chatId: Long,
        @RequestBody request: AddParticipantRequest,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ) {
        val requesterId = requireNotNull(userPrincipal.user.id)
        chatParticipantService.addParticipants(
            chatId,
            requesterId,
            request.userIds
        )
    }

    @PostMapping("/{chatId}/avatar", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadGroupAvatar(
        @PathVariable chatId: Long,
        @RequestPart("file") file: MultipartFile,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): Map<String, String> {
        val userId = requireNotNull(userPrincipal.user.id)
        chatService.ensureCanUpdateGroupAvatar(chatId, userId)
        val ext = file.originalFilename?.substringAfterLast('.', "jpg") ?: "jpg"
        val key = "chat-avatars/${UUID.randomUUID()}.$ext"
        val url = s3StorageService.upload(
            key,
            file.inputStream,
            file.contentType ?: "image/jpeg",
            file.size
        )
        chatService.updateGroupAvatar(chatId, userId, url)
        return mapOf("avatarUrl" to url)
    }

    @PostMapping("/{chatId}/leave")
    fun leaveChat(
        @PathVariable chatId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ) {
        val userId = requireNotNull(userPrincipal.user.id)
        chatParticipantService.leaveChat(chatId, userId)
    }

    @PostMapping("/{chatId}/pin")
    fun pinChat(
        @PathVariable chatId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ) {
        val userId = requireNotNull(userPrincipal.user.id)
        chatParticipantService.pinChat(chatId, userId)
    }

    @DeleteMapping("/{chatId}/pin")
    fun unpinChat(
        @PathVariable chatId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ) {
        val userId = requireNotNull(userPrincipal.user.id)
        chatParticipantService.unpinChat(chatId, userId)
    }

    @DeleteMapping("/{chatId}")
    fun deleteChat(
        @PathVariable chatId: Long,
        @AuthenticationPrincipal userPrincipal: UserPrincipal
    ) {
        val userId = requireNotNull(userPrincipal.user.id)
        chatParticipantService.deleteChat(chatId, userId)
    }
}
