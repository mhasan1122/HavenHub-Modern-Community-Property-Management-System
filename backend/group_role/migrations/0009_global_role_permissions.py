from django.db import migrations, models
import django.db.models.deletion


def create_table_if_not_exists(apps, schema_editor):
    """Create table only if it doesn't already exist"""
    from django.db import connection
    
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
            AND table_name = 'group_role_globalrolepermission'
        """)
        table_exists = cursor.fetchone()[0] > 0
        
        if not table_exists:
            # Table doesn't exist, create it using raw SQL
            cursor.execute("""
                CREATE TABLE `group_role_globalrolepermission` (
                    `id` bigint NOT NULL AUTO_INCREMENT,
                    `category` varchar(50) NOT NULL,
                    `display_name` varchar(255) NOT NULL,
                    `description` longtext,
                    `default_enabled` tinyint(1) NOT NULL,
                    `is_protected` tinyint(1) NOT NULL,
                    `priority` int NOT NULL,
                    `is_active` tinyint(1) NOT NULL,
                    `created_at` datetime(6) NOT NULL,
                    `updated_at` datetime(6) NOT NULL,
                    `created_by_id` bigint DEFAULT NULL,
                    `permission_id` bigint NOT NULL,
                    `updated_by_id` bigint DEFAULT NULL,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `permission_id` (`permission_id`),
                    UNIQUE KEY `group_role_globalrolep_permission_id_category_f17c70e6_uniq` (`permission_id`,`category`),
                    KEY `group_role_globalro_created_by_id_fe623dd9_fk_user_memb` (`created_by_id`),
                    KEY `group_role_globalro_updated_by_id_eae8dfb3_fk_user_memb` (`updated_by_id`),
                    CONSTRAINT `group_role_globalro_created_by_id_fe623dd9_fk_user_memb` FOREIGN KEY (`created_by_id`) REFERENCES `user_member` (`id`),
                    CONSTRAINT `group_role_globalro_permission_id_f84b52a8_fk_group_rol` FOREIGN KEY (`permission_id`) REFERENCES `group_role_permission` (`id`),
                    CONSTRAINT `group_role_globalro_updated_by_id_eae8dfb3_fk_user_memb` FOREIGN KEY (`updated_by_id`) REFERENCES `user_member` (`id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
            """)


def populate_global_role_permissions(apps, schema_editor):
    """Populate initial global role permissions."""
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')
    
    # Define the global permissions structure
    GLOBAL_PERMISSIONS = [
        # Member Management (priority 100)
        {'permission_id': 1, 'display_name': 'Create Member', 'category': 'member_management', 'priority': 90, 'description': 'Allow users to create new members in the system'},
        {'permission_id': 2, 'display_name': 'Edit Member', 'category': 'member_management', 'priority': 85, 'description': 'Allow users to edit member information'},
        {'permission_id': 3, 'display_name': 'View Member List', 'category': 'member_management', 'priority': 95, 'description': 'Allow users to view the list of all members', 'is_protected': True},
        
        # Role Management (priority 80)
        {'permission_id': 4, 'display_name': 'Create Role', 'category': 'role_management', 'priority': 80, 'description': 'Allow users to create new roles'},
        {'permission_id': 5, 'display_name': 'Edit Role', 'category': 'role_management', 'priority': 75, 'description': 'Allow users to edit existing roles'},
        {'permission_id': 6, 'display_name': 'View Role List', 'category': 'role_management', 'priority': 85, 'description': 'Allow users to view all roles', 'is_protected': True},
        
        # Group Management (priority 70)
        {'permission_id': 7, 'display_name': 'Create Group', 'category': 'group_management', 'priority': 70, 'description': 'Allow users to create new groups'},
        {'permission_id': 8, 'display_name': 'Edit Group', 'category': 'group_management', 'priority': 65, 'description': 'Allow users to edit group settings'},
        {'permission_id': 9, 'display_name': 'View Group List', 'category': 'group_management', 'priority': 75, 'description': 'Allow users to view all groups'},
        
        # Tower & Unit Management (priority 60)
        {'permission_id': 10, 'display_name': 'Create Tower', 'category': 'tower_management', 'priority': 60, 'description': 'Allow users to create new towers'},
        {'permission_id': 11, 'display_name': 'Edit Tower', 'category': 'tower_management', 'priority': 55, 'description': 'Allow users to edit tower information'},
        {'permission_id': 12, 'display_name': 'View Tower', 'category': 'tower_management', 'priority': 65, 'description': 'Allow users to view tower details'},
        {'permission_id': 13, 'display_name': 'View Unit Details', 'category': 'tower_management', 'priority': 50, 'description': 'Allow users to view unit information'},
        {'permission_id': 14, 'display_name': 'Edit Unit Details', 'category': 'tower_management', 'priority': 45, 'description': 'Allow users to edit unit information'},
        
        # Communications (priority 40)
        {'permission_id': 25, 'display_name': 'Add Announcements', 'category': 'communications', 'priority': 40, 'description': 'Allow users to create new announcements'},
        {'permission_id': 26, 'display_name': 'View Announcements', 'category': 'communications', 'priority': 45, 'description': 'Allow users to view announcements'},
        {'permission_id': 28, 'display_name': 'Add Bulletin Board Posts', 'category': 'communications', 'priority': 35, 'description': 'Allow users to post on bulletin board'},
        {'permission_id': 29, 'display_name': 'View Bulletin Board', 'category': 'communications', 'priority': 40, 'description': 'Allow users to view bulletin board posts'},
        {'permission_id': 31, 'display_name': 'Add Notice Board', 'category': 'communications', 'priority': 30, 'description': 'Allow users to add notices'},
        {'permission_id': 32, 'display_name': 'View Notice Board', 'category': 'communications', 'priority': 35, 'description': 'Allow users to view notices'},
        
        # Service Fees (priority 50)
        {'permission_id': 35, 'display_name': 'View Service Fee Settings', 'category': 'service_fees', 'priority': 50, 'description': 'Allow users to view service fee configurations'},
        {'permission_id': 38, 'display_name': 'Add Service Fee Settings', 'category': 'service_fees', 'priority': 40, 'description': 'Allow users to create service fee settings'},
        {'permission_id': 39, 'display_name': 'Edit Service Fee Settings', 'category': 'service_fees', 'priority': 35, 'description': 'Allow users to edit service fee settings'},
        {'permission_id': 40, 'display_name': 'View Service Fee Overview', 'category': 'service_fees', 'priority': 45, 'description': 'Allow users to view service fee overview'},
        {'permission_id': 44, 'display_name': 'Record Service Fee Payment', 'category': 'service_fees', 'priority': 30, 'description': 'Allow users to record service fee payments'},
        
        # Financial (priority 25)
        {'permission_id': 60, 'display_name': 'View Bill Categories', 'category': 'financial', 'priority': 25, 'description': 'Allow users to view bill categories'},
        {'permission_id': 61, 'display_name': 'Add Bill Categories', 'category': 'financial', 'priority': 20, 'description': 'Allow users to create bill categories'},
        {'permission_id': 62, 'display_name': 'Edit Bill Categories', 'category': 'financial', 'priority': 15, 'description': 'Allow users to edit bill categories'},
        {'permission_id': 63, 'display_name': 'View Chart of Accounts', 'category': 'financial', 'priority': 22, 'description': 'Allow users to view account chart'},
        {'permission_id': 64, 'display_name': 'Add Chart of Accounts', 'category': 'financial', 'priority': 17, 'description': 'Allow users to add accounts'},
        {'permission_id': 65, 'display_name': 'Edit Chart of Accounts', 'category': 'financial', 'priority': 12, 'description': 'Allow users to edit accounts'},
        
        # Settings (priority 10)
        {'permission_id': 59, 'display_name': 'View Company Settings', 'category': 'settings', 'priority': 10, 'description': 'Allow users to view company settings', 'is_protected': True},
    ]
    
    for perm_data in GLOBAL_PERMISSIONS:
        permission_id = perm_data.pop('permission_id')
        is_protected = perm_data.pop('is_protected', False)
        
        try:
            permission = Permission.objects.get(id=permission_id)
            GlobalRolePermission.objects.get_or_create(
                permission=permission,
                defaults={
                    'is_protected': is_protected,
                    **perm_data
                }
            )
        except Permission.DoesNotExist:
            # Skip if permission doesn't exist
            pass


def add_manage_global_permissions(apps, schema_editor):
    """Add the Manage Global Role Permissions permission."""
    Permission = apps.get_model('group_role', 'Permission')
    GlobalRolePermission = apps.get_model('group_role', 'GlobalRolePermission')
    
    # Create the permission if it doesn't exist
    permission, created = Permission.objects.get_or_create(
        id=66,
        defaults={'permission_name': 'Manage Global Role Permissions'}
    )
    
    # Create the global role permission for it
    GlobalRolePermission.objects.get_or_create(
        permission=permission,
        defaults={
            'category': 'settings',
            'display_name': 'Manage Global Role Permissions',
            'description': 'Allow users to manage global role permissions that apply across all roles',
            'default_enabled': False,
            'is_protected': True,
            'priority': 5
        }
    )


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0001_initial'),
        ('group_role', '0006_add_bill_category_permissions'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='GlobalRolePermission',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('category', models.CharField(
                            choices=[
                                ('member_management', 'Member Management'),
                                ('role_management', 'Role Management'),
                                ('group_management', 'Group Management'),
                                ('tower_management', 'Tower & Unit Management'),
                                ('communications', 'Communications'),
                                ('service_fees', 'Service Fee Management'),
                                ('financial', 'Financial Management'),
                                ('settings', 'Settings & Configuration'),
                            ],
                            default='member_management',
                            max_length=50
                        )),
                        ('display_name', models.CharField(help_text='Human-readable permission name', max_length=255)),
                        ('description', models.TextField(blank=True, help_text='Detailed description of what this permission allows', null=True)),
                        ('default_enabled', models.BooleanField(
                            default=False,
                            help_text='If enabled, this permission is granted to all roles by default unless specifically disabled'
                        )),
                        ('is_protected', models.BooleanField(
                            default=False,
                            help_text='Protected permissions cannot be disabled globally'
                        )),
                        ('priority', models.IntegerField(default=0, help_text='Display priority in UI (higher = higher priority)')),
                        ('is_active', models.BooleanField(default=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name='global_role_permission_created', to='user.member')),
                        ('permission', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='global_role_setting', to='group_role.permission')),
                        ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name='global_role_permission_updated', to='user.member')),
                    ],
                    options={
                        'verbose_name': 'Global Role Permission',
                        'verbose_name_plural': 'Global Role Permissions',
                        'ordering': ['-priority', 'category', 'display_name'],
                        'unique_together': {('permission', 'category')},
                    },
                ),
            ],
            database_operations=[
                migrations.RunPython(
                    code=create_table_if_not_exists,
                    reverse_code=migrations.RunPython.noop,
                ),
            ],
        ),
        migrations.RunPython(
            code=populate_global_role_permissions,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.RunPython(
            code=add_manage_global_permissions,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
