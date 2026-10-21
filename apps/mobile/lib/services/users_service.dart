import 'api_service.dart';

class UsersService {
  static Future<List<Map<String, dynamic>>> getAll({String? q}) async {
    final res = await ApiService.dio.get(
      '/api/v1/users',
      queryParameters: {if (q != null && q.isNotEmpty) 'q': q},
    );
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  static Future<Map<String, dynamic>> create(Map<String, dynamic> body) async {
    final res = await ApiService.dio.post('/api/v1/users', data: body);
    return res.data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> update(
      String id, Map<String, dynamic> body) async {
    final res = await ApiService.dio.patch('/api/v1/users/$id', data: body);
    return res.data as Map<String, dynamic>;
  }

  static Future<void> delete(String id) async {
    await ApiService.dio.delete('/api/v1/users/$id');
  }
}
