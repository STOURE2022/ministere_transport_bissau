from django.contrib import admin

from .models import LogAction


@admin.register(LogAction)
class LogActionAdmin(admin.ModelAdmin):
    list_display = ("action", "user", "ip", "date")
    list_filter = ("action", "date")
    search_fields = ("action", "user__email", "ip")
    readonly_fields = ("id", "action", "user", "objet_type", "objet_id",
                       "metadata", "ip", "user_agent", "date")
    date_hierarchy = "date"

    def has_add_permission(self, request):
        return False  # journal en lecture seule

    def has_change_permission(self, request, obj=None):
        return False
