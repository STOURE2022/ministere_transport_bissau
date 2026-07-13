from django.contrib import admin

from .models import Notification, PreferencesNotification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("titre", "destinataire", "niveau", "categorie", "lu", "date_creation")
    list_filter = ("niveau", "lu", "categorie")
    search_fields = ("titre", "message", "destinataire__email")


@admin.register(PreferencesNotification)
class PreferencesNotificationAdmin(admin.ModelAdmin):
    list_display = ("utilisateur", "canal_email", "canal_sms", "canal_push")
