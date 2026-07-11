from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import OTPCode, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_creation",)
    list_display = ("email", "prenom", "nom", "role", "is_active", "is_verifie", "date_creation")
    list_filter = ("role", "is_active", "is_email_verifie", "is_telephone_verifie")
    search_fields = ("email", "nom", "prenom", "telephone")
    readonly_fields = ("id", "date_creation", "date_maj", "last_login")

    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("Identité", {"fields": ("prenom", "nom", "telephone")}),
        ("Rôle & statut", {"fields": ("role", "is_active", "is_email_verifie", "is_telephone_verifie")}),
        ("Permissions Django", {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_creation", "date_maj")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "prenom", "nom", "telephone", "role", "password1", "password2"),
        }),
    )

    @admin.display(boolean=True, description="Vérifié")
    def is_verifie(self, obj):
        return obj.is_verifie


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "canal", "consomme", "tentatives", "expire_le", "date_creation")
    list_filter = ("canal", "consomme")
    search_fields = ("user__email",)
    readonly_fields = ("id", "code_hash", "date_creation")
