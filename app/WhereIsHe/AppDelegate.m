//
//  AppDelegate.m
//  WhereIsHe
//
//  Created by tomaszbrue on 14.08.13.
//  Copyright (c) 2013 InformMe. All rights reserved.
//

#import "AppDelegate.h"
#import "Reachability.h"
#import "ViewController.h"

@implementation AppDelegate

@synthesize lastUpdate, reachable, locationManager;

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    [UIApplication sharedApplication].idleTimerDisabled = YES;
    
    // Override point for customization after application launch.
    locationManager = [[CLLocationManager alloc] init];
    locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation;
    locationManager.distanceFilter = 3;
    locationManager.delegate = self;
    locationManager.pausesLocationUpdatesAutomatically = YES;
    locationManager.activityType = CLActivityTypeFitness;
    
    [locationManager startUpdatingLocation];
    
    // Allocate a reachability object
    Reachability *reach = [Reachability reachabilityWithHostname:@"www.google.de"];
    
    // Set the blocks
    reach.reachableBlock = ^(Reachability*reach)
    {
        // flush url cache
        if (self.reachable == NO) {
            
            [self flushDataCache: nil];
        }
        
        self.reachable = YES;
    };
    
    reach.unreachableBlock = ^(Reachability*reach)
    {
        self.reachable = NO;
    };
    
    // Start the notifier, which will cause the reachability object to retain itself!
    [reach startNotifier];
    
    return YES;
}

- (void)applicationDidEnterBackground:(UIApplication *)application
{
    ViewController *viewContr = (ViewController *)self.window.rootViewController;
    [viewContr stopUpdating];
}

- (void)applicationWillEnterForeground:(UIApplication *)application
{
    ViewController *viewContr = (ViewController *)self.window.rootViewController;
    [viewContr startUpdating];
}

#pragma mark - Local Notification

- (void)application:(UIApplication *)application didReceiveLocalNotification:(UILocalNotification *)notification {
    NSLog(@"Notification fired");
}

#pragma mark - Location Services

- (void)locationManager:(CLLocationManager *)manager didUpdateToLocation:(CLLocation *)newLocation fromLocation:(CLLocation *)oldLocation
{
    if(newLocation.horizontalAccuracy <= 100 || location == nil)
    {
        location = newLocation;
        lastUpdate = [NSDate date];
        
        if (abs(newLocation.speed - oldLocation.speed) > 1 ||
            [newLocation distanceFromLocation:oldLocation] > locationManager.distanceFilter ||
            oldLocation == nil) {
            
            // only store if under 100m accurancy
            if ([UIApplication sharedApplication].applicationState == UIApplicationStateBackground)
            {
                [self sendBackgroundLocationToServer:newLocation];
            }
            else
            {
                [self sendLocationToServer:newLocation];
            }
        }
    }
}

- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error
{
	// Handle error
    if(error.code == kCLErrorDenied)
    {
        [locationManager stopUpdatingLocation];
    }
    else if(error.code == kCLErrorLocationUnknown)
    {
        // retry
        [locationManager startUpdatingLocation];
    }
}

- (void)locationManagerDidPauseLocationUpdates:(CLLocationManager *)manager {
    NSLog(@"locMan: locationManagerDidPauseLocationUpdates");
    
    [[UIApplication sharedApplication] cancelAllLocalNotifications];
    
    UILocalNotification *localNotification = [[UILocalNotification alloc] init];
    
    localNotification.fireDate = [[NSDate date] dateByAddingTimeInterval:5];
    localNotification.timeZone = [NSTimeZone defaultTimeZone];
    localNotification.alertBody = @"Stopped updating location!";
    localNotification.soundName = UILocalNotificationDefaultSoundName;
    localNotification.applicationIconBadgeNumber = 0; // increment
    
    [[UIApplication sharedApplication] scheduleLocalNotification:localNotification];
    
}

- (void)locationManagerDidResumeLocationUpdates:(CLLocationManager *)manager {
    [[UIApplication sharedApplication] cancelAllLocalNotifications];
    
    UILocalNotification *localNotification = [[UILocalNotification alloc] init];
    
    localNotification.fireDate = [[NSDate date] dateByAddingTimeInterval:5];
    localNotification.timeZone = [NSTimeZone defaultTimeZone];
    localNotification.alertBody = @"Resume updating location.";
    localNotification.soundName = UILocalNotificationDefaultSoundName;
    localNotification.applicationIconBadgeNumber = 0; // increment
    
    [[UIApplication sharedApplication] scheduleLocalNotification:localNotification];
}

- (void)sendBackgroundLocationToServer:(CLLocation *)loc
{
    // Note that the expiration handler block simply ends the task. It is important that we always
    // end tasks that we have started.
    bgTask = [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
    }];

    [self sendLocationToServer:loc];

    // AFTER ALL THE UPDATES close the task
    if (bgTask != UIBackgroundTaskInvalid)
    {
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
        bgTask = UIBackgroundTaskInvalid;
    }
}

- (void)sendLocationToServer:(CLLocation *)loc
{
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
 
    if ([prefs boolForKey:@"service.state"] == YES || [prefs objectForKey:@"service.state"] == nil) {
        
        NSArray *urlCache = [prefs arrayForKey:@"data.cache"];
        
        NSDateFormatter *dateFormat = [[NSDateFormatter alloc] init];
        [dateFormat setTimeZone:[NSTimeZone timeZoneWithName:@"UTC"]];
        [dateFormat setDateFormat:@"yyyy-MM-dd HH:mm:ss"];
        
        float spd = 0;
        if (loc.speed > 0) {
            spd = (float)(loc.speed * 1.94384449);
        }
        
        if(loc.horizontalAccuracy < 0) return;
        
        // add
        NSString *sendURL = [NSString stringWithFormat:@"http://tracktrack.io/reception?boat=3&lat=%f&lon=%f&speed=%f&course=%i&hdop=%i&timestamp=%@",
                             loc.coordinate.latitude,
                             loc.coordinate.longitude,
                             spd,
                             (int)loc.course,
                             (int)loc.horizontalAccuracy,
                             [dateFormat stringFromDate:loc.timestamp]];
        
        NSMutableArray *addToCache = [[NSMutableArray alloc] initWithArray:urlCache];
        [addToCache addObject:sendURL];
        [prefs setObject:[NSArray arrayWithArray:addToCache] forKey:@"data.cache"];
        
        // flush to tcp server
        [self call:addToCache];
    }
}

- (void)flushDataCache:(NSTimer *)theTimer
{
    [self call:[[NSUserDefaults standardUserDefaults] arrayForKey:@"data.cache"]];
}

- (void)call:(NSArray *)urlCache
{
    if (self.reachable == NO || [urlCache count] == 0) {
        return;
    }
     
    for(int i = 0; i < [urlCache count]; i++)
    {
        NSString *urlStr = [urlCache objectAtIndex:i];
        NSString *encodedStr = [urlStr stringByAddingPercentEscapesUsingEncoding:NSASCIIStringEncoding];
        NSURL *url = [NSURL URLWithString:encodedStr];
        if (url != nil) {
            NSData *data = [NSData dataWithContentsOfURL:url];
            NSLog(@"%@", data);
        }
    }
    
    // flush cache
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
    [prefs setObject:[NSArray arrayWithArray:[NSMutableArray array]] forKey:@"data.cache"];
}

@end
