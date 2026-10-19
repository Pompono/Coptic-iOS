import Capacitor
import Foundation
import Security

@objc(CopticSecureAuthStoragePlugin)
public class CopticSecureAuthStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CopticSecureAuthStoragePlugin"
    public let jsName = "SecureAuthStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setItem", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeItem", returnType: CAPPluginReturnPromise)
    ]

    private var service: String {
        "\(Bundle.main.bundleIdentifier ?? "com.pompono.coptic").supabase-auth"
    }

    @objc func getItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Secure storage key is missing.")
            return
        }
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
            return
        }
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            call.reject("Secure storage could not read the account session.")
            return
        }
        call.resolve(["value": value])
    }

    @objc func setItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty,
              let value = call.getString("value") else {
            call.reject("Secure storage key or value is missing.")
            return
        }
        let data = Data(value.utf8)
        let query = baseQuery(key)
        let updates: [String: Any] = [kSecValueData as String: data]
        var status = SecItemUpdate(query as CFDictionary, updates as CFDictionary)
        if status == errSecItemNotFound {
            var attributes = query
            attributes[kSecValueData as String] = data
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(attributes as CFDictionary, nil)
            if status == errSecDuplicateItem {
                status = SecItemUpdate(query as CFDictionary, updates as CFDictionary)
            }
        }
        guard status == errSecSuccess else {
            call.reject("Secure storage could not save the account session.")
            return
        }
        call.resolve()
    }

    @objc func removeItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("Secure storage key is missing.")
            return
        }
        let status = SecItemDelete(baseQuery(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("Secure storage could not clear the account session.")
            return
        }
        call.resolve()
    }

    private func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "supabase.\(key)"
        ]
    }
}
