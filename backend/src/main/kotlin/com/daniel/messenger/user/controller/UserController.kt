package com.daniel.messenger.user.controller

import com.daniel.messenger.security.userdetails.UserPrincipal
import com.daniel.messenger.storage.S3StorageService
import com.daniel.messenger.user.dto.UpdateDisplayNameRequest
import com.daniel.messenger.user.dto.UserSearchResponse
import com.daniel.messenger.user.service.UserService
import jakarta.validation.Valid
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@RestController
@RequestMapping("/users")
class UserController(
    private val userService: UserService,
    private val s3StorageService: S3StorageService,
) {
    @GetMapping("/me")
    fun getMe(@AuthenticationPrincipal userPrincipal: UserPrincipal): UserSearchResponse =
        userService.run { userPrincipal.user.toSearchResponse() }

    @GetMapping("/{id}")
    fun getUser(@PathVariable id: Long): UserSearchResponse {
        val user = userService.findByIdOrThrow(id)
        return userService.run { user.toSearchResponse() }
    }

    @GetMapping("/search")
    fun searchUsers(
        @RequestParam query: String,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): List<UserSearchResponse> {
        val currentUserId = requireNotNull(userPrincipal.user.id)
        return userService.searchUsers(query, currentUserId)
    }

    @PatchMapping("/me")
    fun updateDisplayName(
        @RequestBody @Valid body: UpdateDisplayNameRequest,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ) {
        val userId = requireNotNull(userPrincipal.user.id)
        userService.updateDisplayName(userId, body.displayName)
    }

    @PostMapping("/me/avatar", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadAvatar(
        @RequestPart("file") file: MultipartFile,
        @AuthenticationPrincipal userPrincipal: UserPrincipal,
    ): Map<String, String> {
        val userId = requireNotNull(userPrincipal.user.id)
        val ext = file.originalFilename?.substringAfterLast('.', "jpg") ?: "jpg"
        val key = "avatars/${UUID.randomUUID()}.$ext"
        val url = s3StorageService.upload(
            key, file.inputStream,
            file.contentType ?: "image/jpeg",
            file.size
        )
        userService.updateAvatarUrl(userId, url)
        return mapOf("avatarUrl" to url)
    }
}
