/**
 * Capacitor Runtime Permissions Checker Utility
 * 
 * Bu yardımcı modül, mobil uygulamada (Android/iOS) Kamera, Galeri ve Konum 
 * gibi kritik donanım izinlerinin çalışma zamanında (runtime) kontrol edilmesini
 * ve kullanıcıdan onay istenmesini sağlar.
 * 
 * İhtiyacınız olduğunda yorum satırlarını (uncomment) kaldırıp projenin herhangi bir
 * yerinden çağırabilirsiniz.
 * 
 * Örnek kullanım:
 *   import { checkAndRequestCameraPermission } from "@/lib/permissions-checker";
 *   const hasAccess = await checkAndRequestCameraPermission();
 */

/*
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";

// 1. Kamera İzni Kontrolü ve Talebi
export async function checkAndRequestCameraPermission(): Promise<boolean> {
  try {
    const status = await Camera.checkPermissions();
    if (status.camera === "granted") {
      return true;
    }
    
    const requestStatus = await Camera.requestPermissions({ permissions: ["camera"] });
    return requestStatus.camera === "granted";
  } catch (err) {
    console.error("Kamera izni kontrol edilirken hata oluştu:", err);
    return false;
  }
}

// 2. Galeri/Fotoğraf İzni Kontrolü ve Talebi
export async function checkAndRequestPhotosPermission(): Promise<boolean> {
  try {
    const status = await Camera.checkPermissions();
    if (status.photos === "granted") {
      return true;
    }
    
    const requestStatus = await Camera.requestPermissions({ permissions: ["photos"] });
    return requestStatus.photos === "granted";
  } catch (err) {
    console.error("Galeri izni kontrol edilirken hata oluştu:", err);
    return false;
  }
}

// 3. Konum İzni Kontrolü ve Talebi (ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION)
export async function checkAndRequestLocationPermission(): Promise<boolean> {
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") {
      return true;
    }
    
    const requestStatus = await Geolocation.requestPermissions({ permissions: ["location"] });
    return requestStatus.location === "granted";
  } catch (err) {
    console.error("Konum izni kontrol edilirken hata oluştu:", err);
    return false;
  }
}
*/
