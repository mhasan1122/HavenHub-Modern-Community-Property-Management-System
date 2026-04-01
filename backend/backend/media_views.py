import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.utils.encoding import smart_str
from django.views.decorators.http import require_GET


@require_GET
def media_download(request):
    """
    Download a media file via Django (adds CORS headers via middleware).

    This avoids the common production issue where Nginx serves /media/ without
    CORS headers, causing browser fetch() downloads to fail cross-origin.
    """
    rel_path = request.GET.get("path", "")
    if not rel_path:
        return HttpResponse("Missing required query param: path", status=400)

    # Prevent absolute paths and normalize separators.
    rel_path = rel_path.lstrip("/").replace("\\", "/")

    media_root = Path(settings.MEDIA_ROOT).resolve()
    target = (media_root / rel_path).resolve()

    # Block path traversal.
    if media_root not in target.parents and target != media_root:
        return HttpResponse("Forbidden", status=403)

    if not target.exists() or not target.is_file():
        return HttpResponse("Not found", status=404)

    content_type, _ = mimetypes.guess_type(str(target))
    response = FileResponse(open(target, "rb"), content_type=content_type or "application/octet-stream")
    response["Content-Disposition"] = f'attachment; filename="{smart_str(target.name)}"'
    return response

