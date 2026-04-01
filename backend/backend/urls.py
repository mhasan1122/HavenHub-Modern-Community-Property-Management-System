"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path,include
from django.http import HttpResponse
from django.conf import settings
from django.conf.urls.static import static
from .media_views import media_download

def default_page(request):
    html = """
    <html>
        <head>
            <title>Estate Page</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
            <h1 style="color: #4CAF50;">Welcome to Estate Link Django Dashboard </h1>
        </body>
    </html>
    """
    return HttpResponse(html)

urlpatterns = [
    path('', default_page),
    path('admin/', admin.site.urls),
    path('user/', include('user.urls')),
    path('group_role/', include('group_role.urls')),
    path('towers/', include('towers.urls')),
    path('api/', include('announcements.urls')),
    path('api/', include('bulletins.urls')),
    path('api/noticeboard/', include('noticeboard.urls')),
    path('api/service-fees/', include('service_fee.urls')),
    path('api/service-fee-management/', include('service_fee_management.urls')),
    path('api/contacts/', include('contacts.urls')),
    path('api/company-settings/', include('company_settings.urls')),
    path('api/', include('bill_categories.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/media/download/', media_download, name='media_download'),

]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
